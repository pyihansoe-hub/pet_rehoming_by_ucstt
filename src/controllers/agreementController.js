const pool = require('../db/pool');
const notify = require('../services/notify'); // Added notify service

// POST /api/adoption-requests/:id/agreement
// Creates agreement when owner approves — called internally from adoptionController
const createAgreement = async (adoptionRequestId, terms = null) => {
  try {
    await pool.query(
      `INSERT INTO adoption_agreements (adoption_request_id, terms)
       VALUES ($1, $2) ON CONFLICT (adoption_request_id) DO NOTHING`,
      [adoptionRequestId, terms]
    );
  } catch (err) {
    console.error('Agreement creation failed (non-fatal):', err.message);
  }
};
// PATCH /api/adoption-requests/:id/agreement/agree
// Owner or adopter signs the agreement
const agreeToAdoption = async (req, res) => {
  const adoptionRequestId = req.params.id;
  try {
    // 1. Check user is owner or adopter, and get pet name for notifications
    const { rows: arRows } = await pool.query(
      `SELECT ar.requester_id, p.owner_id, p.name AS pet_name
       FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1 AND ar.status='approved'`,
      [adoptionRequestId]
    );
    if (!arRows.length) return res.status(404).json({ message: 'Approved adoption request not found.' });

    const ar = arRows[0];
    const isOwner   = ar.owner_id    === req.user.id;
    const isAdopter = ar.requester_id === req.user.id;

    if (!isOwner && !isAdopter) return res.status(403).json({ message: 'Not authorized.' });

    const field     = isOwner ? 'owner_agreed'   : 'adopter_agreed';
    const timeField = isOwner ? 'owner_agreed_at' : 'adopter_agreed_at';

    // 2. Update ONLY IF they haven't signed yet (AND ${field}=FALSE)
    const { rows } = await pool.query(
      `UPDATE adoption_agreements
       SET ${field}=TRUE, ${timeField}=NOW()
       WHERE adoption_request_id=$1 AND ${field}=FALSE
       RETURNING *`,
      [adoptionRequestId]
    );

    // If rows.length is 0, it means they ALREADY signed it previously
    if (!rows.length) {
      const { rows: checkRows } = await pool.query(
        `SELECT * FROM adoption_agreements WHERE adoption_request_id=$1`,
        [adoptionRequestId]
      );
      if (!checkRows.length) return res.status(404).json({ message: 'Agreement not found.' });
      
      return res.status(400).json({ 
        message: 'You have already signed this agreement.', 
        agreement: checkRows[0], 
        bothAgreed: checkRows[0].owner_agreed && checkRows[0].adopter_agreed 
      });
    }

    const agreement = rows[0];
    const bothAgreed = agreement.owner_agreed && agreement.adopter_agreed;
    const petName = ar.pet_name || 'အိမ်မွေးတိရစ္ဆာန်';
    const link = `/pages/adoption-requests.html`;

    // 3. Send Notification to BOTH parties about who just signed
    let notifBody = '';
    if (isOwner) {
      notifBody = `ပိုင်ရှင်မှ "${petName}" ၏ သဘောတူညီချက်ကို လက်မှတ်ရေးထိုးပြီးပါပြီ။`;
    } else {
      notifBody = `မွေးစားသူမှ "${petName}" ၏ သဘောတူညီချက်ကို လက်မှတ်ရေးထိုးပြီးပါပြီ။`;
    }

    notify(ar.requester_id, {
      type: 'agreement_signed',
      title: 'သဘောတူညီချက် လက်မှတ်ရေးထိုးပြီး',
      body: notifBody,
      link: link
    });

    notify(ar.owner_id, {
      type: 'agreement_signed',
      title: 'သဘောတူညီချက် လက်မှတ်ရေးထိုးပြီး',
      body: notifBody,
      link: link
    });

    // 4. If BOTH have signed, send a final completion notification to both
    if (bothAgreed) {
      const completeBody = `"${petName}" ၏ မွေးစားခြင်း သဘောတူညီချက်ကို နှစ်ဖက်စလုံး လက်မှတ်ရေးထိုးပြီးပါပြီ။ မွေးစားခြင်း လုပ်ငန်းစဉ် အောင်မြင်စွာ အပြီးသတ်ပါပြီ။`;
      
      notify(ar.requester_id, {
        type: 'agreement_signed',
        title: 'မွေးစားခြင်း ပြီးမြောက်',
        body: completeBody,
        link: link
      });
      
      notify(ar.owner_id, {
        type: 'agreement_signed',
        title: 'မွေးစားခြင်း ပြီးမြောက်',
        body: completeBody,
        link: link
      });
    }

    res.json({
      message: bothAgreed ? 'Both parties agreed. Adoption finalised.' : 'Your agreement recorded.',
      agreement,
      bothAgreed,
    });
  } catch (err) { 
    res.status(500).json({ message: 'Server error.', error: err.message }); 
  }
};

// GET /api/adoption-requests/:id/agreement
const getAgreement = async (req, res) => {
  try {
    const { rows: arRows } = await pool.query(
      `SELECT ar.requester_id, p.owner_id FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [req.params.id]
    );
    if (!arRows.length) return res.status(404).json({ message: 'Not found.' });

    const ar = arRows[0];
    if (ar.owner_id !== req.user.id && ar.requester_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      'SELECT * FROM adoption_agreements WHERE adoption_request_id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'No agreement found yet.' });
    res.json({ agreement: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { createAgreement, agreeToAdoption, getAgreement };