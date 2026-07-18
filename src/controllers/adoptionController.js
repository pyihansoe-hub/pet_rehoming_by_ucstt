const pool = require('../db/pool');
const notify = require('../services/notify');

const { createAgreement } = require('./agreementController');
const { scheduleFollowupReminders } = require('../services/reminderScheduler');
const { logStatusChange } = require('../services/petStatusHistory');

const calculateOwnerPayout = (baseFee) => {
  const fee = parseFloat(baseFee) || 0;
  const serviceFee = fee * 0.04;
  const transactionFee = fee * 0.015;
  const totalDeduction = serviceFee + transactionFee;
  const netPayout = fee - totalDeduction;

  return {
    baseFee: fee.toLocaleString(),
    serviceFee: serviceFee.toLocaleString(),
    transactionFee: transactionFee.toLocaleString(),
    totalDeduction: totalDeduction.toLocaleString(),
    netPayout: netPayout.toLocaleString()
  };
};

const requestAdoption = async (req, res) => {
  const petId = req.params.id;
  const { message } = req.body;

  try {
    const { rows: pets } = await pool.query(
      'SELECT id, name, owner_id, status, fee_type, adoption_fee FROM pets WHERE id=$1', 
      [petId]
    );
    
    if (!pets.length) return res.status(404).json({ message: 'အိမ်မွေးတိရစ္ဆာန် မတွေ့ရှိပါ။' });
    const pet = pets[0];
    
    if (pet.status !== 'available') return res.status(400).json({ message: 'ဤအိမ်မွေးတိရစ္ဆာန်သည် မွေးစားရန် မရရှိနိုင်ပါ။' });
    if (pet.owner_id === req.user.id) return res.status(400).json({ message: 'ကိုယ်ပိုင်အိမ်မွေးတိရစ္ဆာန်ကို မွေးစား၍မရပါ။' });

    const { rows: activeReqs } = await pool.query(
      `SELECT id FROM adoption_requests 
       WHERE pet_id=$1 AND requester_id=$2 AND status IN ('pending', 'approved')`,
      [petId, req.user.id]
    );

    if (activeReqs.length > 0) {
      return res.status(409).json({ message: 'ဤအိမ်မွေးတိရစ္ဆာန်အတွက် တက်ကြွသော တောင်းဆိုချက်တစ်ခု ရှိနေပါသည်။ အသစ်တစ်ခု တင်သွင်းရန် ယခင်တောင်းဆိုချက်ကို အရင် ဖျက်သိမ်းပါ။' });
    }

    const ins = await pool.query(
      `INSERT INTO adoption_requests (pet_id, requester_id, message)
       VALUES ($1,$2,$3) RETURNING *`,
      [petId, req.user.id, message || null]
    );
    const requestRow = ins.rows[0];

    res.status(201).json({
      message: 'မွေးစားရန် တောင်းဆိုချက် တင်သွင်းပြီးပါပြီ။',
      request: requestRow,
      paymentRequired: pet.fee_type === 'paid',
      adoptionFee: pet.fee_type === 'paid' ? pet.adoption_fee : 0,
    });

    let notifTitle = `${pet.name} အတွက် မွေးစားရန် တောင်းဆိုချက်အသစ်`;
    let notifBody = `${req.user.name} မှ သင်၏အိမ်မွေးတိရစ္ဆာန်ကို မွေးစားလိုပါသည်။`;
    
    if (pet.fee_type === 'paid' && pet.adoption_fee > 0) {
      const calc = calculateOwnerPayout(pet.adoption_fee);
      
      notifBody = 
        `${req.user.name} မှ မွေးစားခ ${calc.baseFee} ကျပ် ပေးချေထားပါသည်။ ` +
        `သင်၏ရရှိငွေမှ ပလက်ဖောင်းအခကြေးငွေများ နုတ်ယူထားပါသည်- ` +
        `ဝန်ဆောင်မှုခ (4%) = ${calc.serviceFee} ကျပ်၊ ` +
        `ငွေလွှဲခ (1.5%) = ${calc.transactionFee} ကျပ်။ ` +
        `စုစုပေါင်း နုတ်ယူငွေ = ${calc.totalDeduction} ကျပ်။ ` +
        `သင်၏ နောက်ဆုံးရရှိငွေမှာ ${calc.netPayout} ကျပ် ဖြစ်ပါသည်။`;
    }

    notify(pet.owner_id, {
      type: 'new_adoption_request',
      title: notifTitle,
      body: notifBody,
      link: `/pages/adoption-requests.html?tab=received`,
    });

    const { send, emails } = require('../services/email');
    pool.query('SELECT name, email FROM users WHERE id=$1', [pet.owner_id])
      .then(({ rows }) => {
        if (rows.length > 0) {
          const tmpl = emails.adoptionRequestReceived(rows[0].name, pet.name, req.user.name);
          return send(rows[0].email, tmpl.subject, tmpl.html);
        }
      })
      .catch(err => console.error('Email failed:', err.message));

  } catch (err) {
    res.status(500).json({ message: 'ဆာဗာ အမှား။', error: err.message });
  }
};

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
  } catch (err) {
    res.status(500).json({ message: 'ဆာဗာ အမှား။', error: err.message });
  }
};

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
  } catch (err) {
    res.status(500).json({ message: 'ဆာဗာ အမှား။', error: err.message });
  }
};

const reviewRequest = async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ message: 'အခြေအနေသည် အတည်ပြုပြီး သို့မဟုတ် ငြင်းပယ်ထားသည် ဖြစ်ရပါမည်။' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT ar.*, p.owner_id, p.fee_type FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: 'တောင်းဆိုချက် မတွေ့ရှိပါ။' });
    const req_ = rows[0];

    if (req_.owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'အခွင့်အာဏာ မရှိပါ။' });

    await client.query(
      `UPDATE adoption_requests SET status=$1, reviewed_at=NOW() WHERE id=$2`,
      [status, req.params.id]
    );

    if (status === 'approved') {
      await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [req_.pet_id]);

      await client.query(
        `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
         WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
        [req_.pet_id, req.params.id]
      );
    }

    await client.query('COMMIT');

    if (status === 'approved') {
      await createAgreement(req.params.id);
      await scheduleFollowupReminders(req.params.id);
      await logStatusChange(
        req_.pet_id,
        'available',
        'adopted',
        req.user.id,
        'Adoption approved by owner'
      );
    }

    const { send, emails } = require('../services/email');

    notify(req_.requester_id, {
      type: 'adoption_reviewed',
      title: status === 'approved'
        ? 'သင်၏မွေးစားရန် တောင်းဆိုချက် အတည်ပြုပြီးပါပြီ။'
        : 'မွေးစားရန် တောင်းဆိုချက် အပ်ဒိတ်',
      body: status === 'approved'
        ? `သင်၏တောင်းဆိုချက် အတည်ပြုပြီးပါပြီ။ ${req_.fee_type === 'paid' ? 'မွေးစားခြင်း အပြီးသတ်ရန် ငွေပေးချေမှု ပြုလုပ်ပါ။' : 'မက်ဆေ့ခ်ျများတွင် ပိုင်ရှင်နှင့် ဆက်သွယ်၍ အိမ်မွေးတိရစ္ဆာန်ကို သွားရောက်ကြိုယူရန် စီစဉ်ပါ။'}`
        : 'ဤတစ်ကြိမ်တွင် သင်၏မွေးစားရန် တောင်းဆိုချက် အတည်ပြုမခံရပါ။',
      link: `/pages/messages.html?conv=recent`,
    });

    try {
      const { rows: userRows } = await pool.query(
        'SELECT name, email FROM users WHERE id=$1', [req_.requester_id]
      );
      const { rows: petRows } = await pool.query(
        'SELECT name FROM pets WHERE id=$1', [req_.pet_id]
      );

      const requester = userRows[0];
      const pet = petRows[0];

      if (status === 'approved') {
        const tmpl = emails.adoptionApproved(
          requester.name,
          pet.name,
          req_.fee_type === 'free'
        );
        await send(requester.email, tmpl.subject, tmpl.html);
      } else {
        const tmpl = emails.adoptionRejected(requester.name, pet.name);
        await send(requester.email, tmpl.subject, tmpl.html);
      }
    } catch (emailErr) {
      console.error('Email failed (non-fatal):', emailErr.message);
    }

    if (status === 'approved') {
      try {
        await pool.query(
          `INSERT INTO conversations (adoption_request_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [req.params.id]
        );
      } catch(e) { console.error('Chat creation skipped:', e.message); }
    }

    res.json({
      message: `တောင်းဆိုချက် ${status}။`,
      requiresPayment: status === 'approved' && req_.fee_type === 'paid'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'ဆာဗာ အမှား။', error: err.message });
  } finally {
    client.release();
  }
};

const cancelRequest = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT requester_id, status FROM adoption_requests WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: 'တောင်းဆိုချက် မတွေ့ရှိပါ။' });
    if (rows[0].requester_id !== req.user.id)
      return res.status(403).json({ message: 'အခွင့်အာဏာ မရှိပါ။' });
    if (rows[0].status !== 'pending')
      return res.status(400).json({ message: 'ဆိုင်းငံ့ဆဲ တောင်းဆိုချက်များကိုသာ ဖျက်သိမ်းနိုင်ပါသည်။' });

    await pool.query(
      `UPDATE adoption_requests SET status='cancelled' WHERE id=$1`,
      [req.params.id]
    );

    res.json({ message: 'တောင်းဆိုချက် ဖျက်သိမ်းပြီးပါပြီ။' });
  } catch (err) {
    res.status(500).json({ message: 'ဆာဗာ အမှား။', error: err.message });
  }
};

const linkPayment = async (req, res) => {
  try {
    const { payment_id } = req.body;
    const requestId = req.params.id;
    const userId = req.user.id;

    if (!payment_id) {
      return res.status(400).json({ ok: false, message: 'ငွေပေးချေမှု ID လိုအပ်ပါသည်' });
    }

    const check = await pool.query(
      'SELECT id FROM adoption_requests WHERE id = $1 AND requester_id = $2',
      [requestId, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'တောင်းဆိုချက် မတွေ့ရှိပါ' });
    }

    const result = await pool.query(
      'UPDATE adoption_requests SET payment_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [payment_id, requestId]
    );

    res.json({ 
      ok: true, 
      request: result.rows[0] 
    });

  } catch (err) {
    console.error('linkPayment error:', err);
    res.status(500).json({ ok: false, message: 'ငွေပေးချေမှု ချိတ်ဆက်၍မရပါ' });
  }
};

module.exports = {
  requestAdoption,
  myRequests,
  receivedRequests,
  reviewRequest,
  cancelRequest,
  linkPayment
};