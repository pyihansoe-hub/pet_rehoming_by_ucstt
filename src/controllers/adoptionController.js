const pool = require('../db/pool');
const notify = require('../services/notify');

// Standard adoption contract template
const ADOPTION_CONTRACT_TEMPLATE = (petName, adopterName, ownerName, date) => `
ADOPTION AGREEMENT

Date: ${date}

Pet Name: ${petName}
Current Owner: ${ownerName}
Adopter: ${adopterName}

TERMS AND CONDITIONS:

1. The adopter agrees to provide proper care, including adequate food, water, shelter, and veterinary care for the pet.

2. The adopter understands that this is a permanent commitment and agrees not to abandon the pet.

3. The current owner confirms that to the best of their knowledge, the pet's health information provided is accurate.

4. Both parties agree to maintain communication for follow-up checks as reasonably requested.

5. The adopter acknowledges receiving any relevant pet documentation (vaccination records, etc.).

By agreeing to this contract, both parties confirm they understand and accept these terms.
`;

// POST /api/pets/:id/adopt  — submit adoption request
const requestAdoption = async (req, res) => {
  const petId = req.params.id;
  const { message } = req.body;

  try {
    const { rows: pets } = await pool.query(
      'SELECT id, owner_id, status, fee_type, adoption_fee FROM pets WHERE id=$1', [petId]
    );
    if (!pets.length) return res.status(404).json({ message: 'Pet not found.' });
    const pet = pets[0];
    if (pet.status !== 'available') return res.status(400).json({ message: 'Pet is not available for adoption.' });
    if (pet.owner_id === req.user.id) return res.status(400).json({ message: 'You cannot adopt your own pet.' });

    const { rows } = await pool.query(
      `INSERT INTO adoption_requests (pet_id, requester_id, message)
       VALUES ($1,$2,$3) RETURNING *`,
      [petId, req.user.id, message || null]
    );

    res.status(201).json({
      message: 'Adoption request submitted.',
      request: rows[0],
      paymentRequired: pet.fee_type === 'paid',
      adoptionFee: pet.fee_type === 'paid' ? pet.adoption_fee : 0,
    });
    //@2
    notify(pet.owner_id, {
  type:  'new_adoption_request',
  title: `New adoption request for ${pet.name}`,
  body:  `${req.user.name} wants to adopt your pet.`,
  link:  `/adoption-requests/received`,
});
    const { send, emails } = require('../services/email');
    pool.query('SELECT name, email FROM users WHERE id=$1', [pet.owner_id])
    .then(({ rows }) => {
    const tmpl = emails.adoptionRequestReceived(rows[0].name, pet.name, req.user.name);
    return send(rows[0].email, tmpl.subject, tmpl.html);
  })
  .catch(err => console.error('Email failed:', err.message));

  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'You already have a pending request for this pet.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/adoption-requests/mine  — requester's own requests
const myRequests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.*, p.name AS pet_name, pt.name AS pet_type, p.fee_type, p.adoption_fee
       FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id
       JOIN pet_types pt ON pt.id=p.pet_type_id
       WHERE ar.requester_id=$1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/adoption-requests/received  — requests on owner's pets
const receivedRequests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.*, p.name AS pet_name, u.name AS requester_name, u.email AS requester_email, u.phone AS requester_phone
       FROM adoption_requests ar
       JOIN pets p  ON p.id=ar.pet_id
       JOIN users u ON u.id=ar.requester_id
       WHERE p.owner_id=$1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/adoption-requests/:id  — approve / reject (owner)
const reviewRequest = async (req, res) => {
  const { status } = req.body; // approved | rejected
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ message: 'Status must be approved or rejected.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT ar.*, p.owner_id, p.fee_type, p.name AS pet_name FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    const req_ = rows[0];
    if (req_.owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    await client.query(
      `UPDATE adoption_requests SET status=$1, reviewed_at=NOW() WHERE id=$2`,
      [status, req.params.id]
    );

    // If approved + free → mark pet as adopted immediately
    if (status === 'approved' && req_.fee_type === 'free') {
      await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [req_.pet_id]);
      // Reject all other pending requests for this pet
      await client.query(
        `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
         WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
        [req_.pet_id, req.params.id]
      );
      
      // Create follow-up reminders (1 week, 1 month, 3 months)
      const now = new Date();
      await client.query(
        `INSERT INTO adoption_reminders (adoption_request_id, reminder_type, due_at) 
         VALUES ($1, '1_week', $2), ($1, '1_month', $3), ($1, '3_months', $4)`,
        [req.params.id, 
         new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
         new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
         new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)]
      );
    }

    await client.query('COMMIT');
    const { send, emails } = require('../services/email');
    // notify requester @1
  notify(req_.requester_id, {
  type:  'adoption_reviewed',
  title: status === 'approved' ? `Your adoption request was approved!` : `Adoption request update`,
  body:  status === 'approved'
    ? `Your request has been approved. ${req_.fee_type === 'paid' ? 'Please complete payment.' : 'Contact the owner to arrange pickup.'}`
    : `Your adoption request was not approved this time.`,
  link:  `/adoption-requests/${req.params.id}`,
});


try {
  // notify requester
  const { rows: userRows } = await pool.query(
    'SELECT name, email FROM users WHERE id=$1', [req_.requester_id]
  );
  const { rows: petRows } = await pool.query(
    'SELECT name FROM pets WHERE id=$1', [req_.pet_id]
  );
  const requester = userRows[0];
  const pet       = petRows[0];

  if (status === 'approved') {
    const tmpl = emails.adoptionApproved(requester.name, pet.name, req_.fee_type === 'free');
    await send(requester.email, tmpl.subject, tmpl.html);
  } else {
    const tmpl = emails.adoptionRejected(requester.name, pet.name);
    await send(requester.email, tmpl.subject, tmpl.html);
  }
} catch (emailErr) {
  console.error('Email failed (non-fatal):', emailErr.message);
}

    res.json({ message: `Request ${status}.`, requiresPayment: status === 'approved' && req_.fee_type === 'paid' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};

// PATCH /api/adoption-requests/:id/cancel  — requester cancels
const cancelRequest = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT requester_id, status FROM adoption_requests WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    if (rows[0].requester_id !== req.user.id) return res.status(403).json({ message: 'Not authorized.' });
    if (rows[0].status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be cancelled.' });

    await pool.query(`UPDATE adoption_requests SET status='cancelled' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Request cancelled.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/adoption-requests/:id/agree-contract — adopter agrees to contract after approval
const agreeContract = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT ar.*, p.name AS pet_name, p.owner_id, u.name AS owner_name, u2.name AS adopter_name
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       JOIN users u ON u.id = p.owner_id
       JOIN users u2 ON u2.id = ar.requester_id
       WHERE ar.id = $1`,
      [req.params.id]
    );
    
    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    const req_ = rows[0];
    
    // Only the approved requester can agree
    if (req_.requester_id !== req.user.id || req_.status !== 'approved') {
      return res.status(403).json({ message: 'Not authorized or request not approved.' });
    }
    
    if (req_.contract_agreed) {
      return res.status(400).json({ message: 'Contract already agreed.' });
    }
    
    const contractText = ADOPTION_CONTRACT_TEMPLATE(
      req_.pet_name,
      req_.adopter_name,
      req_.owner_name,
      new Date().toISOString()
    );
    
    await client.query('BEGIN');
    await client.query(
      `UPDATE adoption_requests 
       SET contract_agreed = TRUE, contract_text = $1, contract_signed_at = NOW() 
       WHERE id = $2`,
      [contractText, req.params.id]
    );
    await client.query('COMMIT');
    
    res.json({ message: 'Contract agreed successfully.', contract: contractText });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally {
    client.release();
  }
};

// GET /api/adoption-requests/:id/contract — get the agreed contract
const getContract = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.contract_text, ar.contract_signed_at, ar.contract_agreed,
              p.name AS pet_name, u.name AS owner_name, u2.name AS adopter_name
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       JOIN users u ON u.id = p.owner_id
       JOIN users u2 ON u2.id = ar.requester_id
       WHERE ar.id = $1`,
      [req.params.id]
    );
    
    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    const data = rows[0];
    
    if (!data.contract_agreed) {
      return res.status(404).json({ message: 'No contract agreed yet.' });
    }
    
    // Check authorization (owner or adopter only)
    const auth = await pool.query(
      'SELECT requester_id FROM adoption_requests WHERE id = $1',
      [req.params.id]
    );
    const adoptionReq = auth.rows[0];
    
    // Get pet owner to check
    const petOwner = await pool.query(
      'SELECT p.owner_id FROM pets p JOIN adoption_requests ar ON ar.pet_id = p.id WHERE ar.id = $1',
      [req.params.id]
    );
    
    if (req.user.id !== adoptionReq.requester_id && req.user.id !== petOwner.rows[0].owner_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' });
    }
    
    res.json({ 
      contract: data.contract_text,
      signedAt: data.contract_signed_at,
      petName: data.pet_name,
      ownerName: data.owner_name,
      adopterName: data.adopter_name
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/adoption-requests/:id/contact-info — Get contact info (revealed only after contract signed + payment complete)
const getContactInfo = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.status, ar.contract_agreed, ar.contract_signed_at, p.owner_id, p.fee_type,
              u.name AS owner_name, u.phone AS owner_phone, u.address AS owner_address,
              u2.name AS adopter_name, u2.phone AS adopter_phone, u2.address AS adopter_address
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       JOIN users u ON u.id = p.owner_id
       JOIN users u2 ON u2.id = ar.requester_id
       WHERE ar.id = $1`,
      [req.params.id]
    );
    
    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    const data = rows[0];
    
    // Check authorization (owner or adopter only)
    if (req.user.id !== data.owner_id && req.user.id !== data.adopter_name && req.user.role !== 'admin') {
      // Need to check adopter ID properly
      const adopterCheck = await pool.query(
        'SELECT requester_id FROM adoption_requests WHERE id = $1',
        [req.params.id]
      );
      if (req.user.id !== adopterCheck.rows[0].requester_id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized.' });
      }
    }
    
    // Contact info is revealed only when:
    // 1. Adoption is approved/completed
    // 2. Contract is signed (if required)
    // 3. Payment is complete (if paid adoption)
    const isApproved = ['approved', 'completed'].includes(data.status);
    const isContractSigned = data.contract_agreed || data.fee_type === 'free';
    
    // Check payment status for paid adoptions
    let isPaymentComplete = true;
    if (data.fee_type === 'paid') {
      const { rows: paymentRows } = await pool.query(
        `SELECT status FROM payments WHERE adoption_request_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.id]
      );
      isPaymentComplete = paymentRows.length > 0 && paymentRows[0].status === 'completed';
    }
    
    const shouldReveal = isApproved && isContractSigned && isPaymentComplete;
    
    res.json({
      revealed: shouldReveal,
      message: shouldReveal ? 'Contact information unlocked.' : 'Contact information will be revealed after contract signing and payment completion.',
      requirements: {
        approved: isApproved,
        contractSigned: isContractSigned,
        paymentComplete: isPaymentComplete
      },
      contact: shouldReveal ? {
        owner: {
          name: data.owner_name,
          phone: data.owner_phone,
          address: data.owner_address
        },
        adopter: {
          name: data.adopter_name,
          phone: data.adopter_phone,
          address: data.adopter_address
        }
      } : null
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { requestAdoption, myRequests, receivedRequests, reviewRequest, cancelRequest, agreeContract, getContract, getContactInfo };
