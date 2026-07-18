const pool = require('../db/pool');
const notify = require('../services/notify');

// Helper — check user is owner or adopter of adoption request
const getConversationAccess = async (conversationId, userId, role) => {
  const { rows } = await pool.query(
    `SELECT ar.requester_id, p.owner_id
     FROM conversations c
     JOIN adoption_requests ar ON ar.id=c.adoption_request_id
     JOIN pets p ON p.id=ar.pet_id
     WHERE c.id=$1`,
    [conversationId]
  );
  if (!rows.length) return { allowed: false, notFound: true };
  
  const allowed = role === 'admin' || rows[0].requester_id === userId || rows[0].owner_id === userId;
  return { allowed, participants: rows[0] };
};

// POST /api/messages/conversations
const getOrCreateConversation = async (req, res) => {
  const { adoption_request_id } = req.body;
  if (!adoption_request_id) return res.status(400).json({ message: 'adoption_request_id is required.' });

  try {
    const { rows: arRows } = await pool.query(
      `SELECT ar.id, ar.requester_id, ar.status, p.owner_id
       FROM adoption_requests ar JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1`,
      [adoption_request_id]
    );
    if (!arRows.length) return res.status(404).json({ message: 'Adoption request not found.' });
    const ar = arRows[0];

    if (ar.owner_id !== req.user.id && ar.requester_id !== req.user.id)
      return res.status(403).json({ message: 'Not authorized.' });
    if (ar.status !== 'approved')
      return res.status(400).json({ message: 'Conversation only available after approval.' });

    const { rows } = await pool.query(
      `INSERT INTO conversations (adoption_request_id)
       VALUES ($1)
       ON CONFLICT (adoption_request_id) DO UPDATE SET adoption_request_id=EXCLUDED.adoption_request_id
       RETURNING *`,
      [adoption_request_id]
    );
    res.status(201).json({ conversation: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/messages/conversations
const listConversations = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.adoption_request_id, c.created_at,
              p.name AS pet_name,
              owner.name   AS owner_name,
              adopter.name AS adopter_name,
              (SELECT content FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*) FROM messages WHERE conversation_id=c.id AND is_read=FALSE AND sender_id<>$1) AS unread_count
       FROM conversations c
       JOIN adoption_requests ar ON ar.id=c.adoption_request_id
       JOIN pets     p       ON p.id=ar.pet_id
       JOIN users    owner   ON owner.id=p.owner_id
       JOIN users    adopter ON adopter.id=ar.requester_id
       WHERE p.owner_id=$1 OR ar.requester_id=$1
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/messages/conversations/:id
const getMessages = async (req, res) => {
  try {
    const access = await getConversationAccess(req.params.id, req.user.id, req.user.role);
    if (access.notFound) return res.status(404).json({ message: 'Conversation not found.' });
    if (!access.allowed) return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m JOIN users u ON u.id=m.sender_id
       WHERE m.conversation_id=$1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    await pool.query(
      `UPDATE messages SET is_read=TRUE
       WHERE conversation_id=$1 AND sender_id<>$2 AND is_read=FALSE`,
      [req.params.id, req.user.id]
    );

    res.json({ messages: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/messages/conversations/:id
const sendMessage = async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Message content is required.' });

  try {
    const access = await getConversationAccess(req.params.id, req.user.id, req.user.role);
    if (access.notFound) return res.status(404).json({ message: 'Conversation not found.' });
    if (!access.allowed) return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.user.id, content.trim()]
    );
    res.status(201).json({ message: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/messages/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS unread
       FROM messages m
       JOIN conversations c ON c.id=m.conversation_id
       JOIN adoption_requests ar ON ar.id=c.adoption_request_id
       JOIN pets p ON p.id=ar.pet_id
       WHERE (p.owner_id=$1 OR ar.requester_id=$1)
         AND m.sender_id<>$1
         AND m.is_read=FALSE`,
      [req.user.id]
    );
    res.json({ unread: +rows[0].unread });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};
// POST /api/messages/conversations/:id/decline-and-refund
const declineAndRefund = async (req, res) => {
  const { id: conversationId } = req.params;
  const { pet_status_choice } = req.body; 
  const ownerId = req.user.id;

  if (!['available', 'withdrawn'].includes(pet_status_choice)) {
    return res.status(400).json({ message: 'You must choose to make the pet available or withdraw it.' });
  }

  const client = await pool.connect();
  try {
    const access = await getConversationAccess(conversationId, req.user.id, req.user.role);
    if (access.notFound) return res.status(404).json({ message: 'Conversation not found.' });
    if (!access.allowed) return res.status(403).json({ message: 'Not authorized.' });

    if (req.user.role !== 'admin' && access.participants.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the pet owner can issue a refund.' });
    }

    const adopterId = access.participants.requester_id;
    const ownerDbId = access.participants.owner_id;

    await client.query('BEGIN');

    const { rows: convRows } = await client.query('SELECT adoption_request_id FROM conversations WHERE id=$1', [conversationId]);
    
    if (convRows.length > 0) {
      const arId = convRows[0].adoption_request_id;

      const { rows: arRows } = await client.query(
        `SELECT ar.pet_id, p.name AS pet_name, p.fee_type, p.adoption_fee, u.name AS owner_name 
         FROM adoption_requests ar 
         JOIN pets p ON p.id = ar.pet_id 
         JOIN users u ON u.id = p.owner_id 
         WHERE ar.id=$1`, 
        [arId]
      );
      
      if (arRows.length > 0) {
        const petId = arRows[0].pet_id;
        const petName = arRows[0].pet_name;
        const ownerName = arRows[0].owner_name;
        const feeType = arRows[0].fee_type;
        const baseFee = parseFloat(arRows[0].adoption_fee) || 0;

        let adopterRefundMsg = '';
        let ownerFeeMsg = '';

        if (feeType === 'paid' && baseFee > 0) {
          const serviceFee = baseFee * 0.04;
          const transactionFee = baseFee * 0.015;
          const totalFees = serviceFee + transactionFee;

          adopterRefundMsg = `သင်၏ ပေးချေငွေ ${baseFee.toLocaleString()} ကျပ် အား အပြည့်အဝ ပြန်လည် ထုတ်ပေးထားပါသည်။`;
          ownerFeeMsg = `မွေးစားသူအား ပြန်လည်ပေးချေငွေ: ${baseFee.toLocaleString()} ကျပ် • သင်ထမ်းဆောင်ရမည့် စုစုပေါင်းကြေး: ${totalFees.toLocaleString()} ကျပ်`;
        }

        // 1. Update Payment Status to 'refunded' (safely, if it exists)
        await client.query(
          `UPDATE payments SET status = 'refunded', updated_at = NOW() 
           WHERE adoption_request_id = $1 AND status = 'completed'`, 
          [arId]
        );

        // 2. Cancel the linked adoption request
        await client.query(
          `UPDATE adoption_requests SET status='cancelled', reviewed_at=NOW() WHERE id=$1`,
          [arId]
        );

        // 3. Update pet status based on owner's choice
        await client.query(`UPDATE pets SET status=$1 WHERE id=$2`, [pet_status_choice, petId]);

        // 4. Delete the conversation entirely
        await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);

        // 5. Send Notifications (Wrapped in try-catch so it never crashes the refund)
        try {
          let adopterNotifBody = `${ownerName} မှ "${petName}" အတွက် မွေးစားရန် တောင်းဆိုချက်ကို ပယ်ဖျက်ပြီး ငွေပြန်အမ်းခဲ့ပါသည်။`;
          if (adopterRefundMsg) adopterNotifBody += ' ' + adopterRefundMsg;

          notify(adopterId, {
            type: 'adoption_refunded',
            title: 'မွေးစားရန် တောင်းဆိုချက် ပယ်ဖျက်ခြင်း နှင့် ငွေပြန်အမ်းခြင်း',
            body: adopterNotifBody,
            link: `/pages/adoption-requests.html?tab=sent`,
          });

          if (ownerFeeMsg) {
            notify(ownerDbId, {
              type: 'refund_fee_charged',
              title: 'ငွေပြန်အမ်းခြင်း အခကြေးငွေ ကျသင့်မှု',
              body: `"${petName}" အတွက် ငွေပြန်အမ်းလိုက်ပါသည်။ ` + ownerFeeMsg,
              link: `/pages/adoption-requests.html?tab=received`,
            });
          }
        } catch(notifErr) {
          console.error('Notification failed (non-fatal):', notifErr.message);
        }
      }
    }

    await client.query('COMMIT');
    res.json({ 
      ok: true, 
      message: `Refund processed successfully. Pet is now ${pet_status_choice}.`,
      pet_status: pet_status_choice
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ REFUND ERROR:', err);
    res.status(500).json({ message: 'Server error during refund.', error: err.message });
  } finally {
    client.release();
  }
};
module.exports = { 
  getOrCreateConversation, 
  listConversations, 
  getMessages, 
  sendMessage, 
  getUnreadCount, 
  declineAndRefund 
};