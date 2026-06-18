const pool = require('../db/pool');

// POST /api/messages/send — send a message to another user (only if adoption approved)
const sendMessage = async (req, res) => {
  const { receiverId, adoptionRequestId, content } = req.body;
  
  if (!receiverId || !content || !content.trim()) {
    return res.status(400).json({ message: 'Receiver ID and message content are required.' });
  }

  try {
    // Verify that there's an approved adoption request linking these users
    let adoptionReq;
    if (adoptionRequestId) {
      const { rows } = await pool.query(
        `SELECT ar.*, p.owner_id 
         FROM adoption_requests ar
         JOIN pets p ON p.id = ar.pet_id
         WHERE ar.id = $1 AND ar.status = 'approved'`,
        [adoptionRequestId]
      );
      adoptionReq = rows[0];
      
      if (!adoptionReq) {
        return res.status(403).json({ message: 'No approved adoption request found. Messaging is only available after adoption approval.' });
      }
      
      // Verify sender is either owner or adopter
      if (req.user.id !== adoptionReq.owner_id && req.user.id !== adoptionReq.requester_id) {
        return res.status(403).json({ message: 'Not authorized to send messages for this adoption.' });
      }
      
      // Verify receiver is the other party
      if (receiverId !== adoptionReq.owner_id && receiverId !== adoptionReq.requester_id) {
        return res.status(400).json({ message: 'Can only send messages to the adoption partner.' });
      }
    } else {
      // If no adoption request ID provided, check if there's any approved adoption between these users
      const { rows } = await pool.query(
        `SELECT ar.id, p.owner_id 
         FROM adoption_requests ar
         JOIN pets p ON p.id = ar.pet_id
         WHERE ar.status = 'approved' 
           AND ((p.owner_id = $1 AND ar.requester_id = $2) OR (p.owner_id = $2 AND ar.requester_id = $1))
         LIMIT 1`,
        [req.user.id, receiverId]
      );
      
      if (!rows.length) {
        return res.status(403).json({ message: 'No approved adoption relationship found. Messaging is only available after adoption approval.' });
      }
      
      adoptionReq = rows[0];
      adoptionRequestId = adoptionReq.id;
    }

    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, adoption_request_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, receiverId, adoptionRequestId, content.trim()]
    );

    // Send notification to receiver
    const notify = require('../services/notify');
    await notify(receiverId, {
      type: 'new_message',
      title: 'New message received',
      body: `${req.user.name} sent you a message`,
      link: `/messages`
    });

    res.status(201).json({ message: 'Message sent successfully.', message: rows[0] });
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/messages/conversations — get list of conversations
const getConversations = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (partner_id)
              partner_id,
              partner_name,
              partner_avatar,
              last_message,
              last_message_time,
              unread_count
       FROM (
         SELECT 
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
           u.name AS partner_name,
           u.avatar_url AS partner_avatar,
           m.content AS last_message,
           m.created_at AS last_message_time,
           COUNT(*) FILTER (WHERE m.receiver_id = $1 AND m.is_read = FALSE) OVER (
             PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
           ) AS unread_count
         FROM messages m
         JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.created_at DESC
       ) sub
       ORDER BY partner_id, last_message_time DESC`,
      [req.user.id]
    );

    res.json({ conversations: rows });
  } catch (err) {
    console.error('Get conversations error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/messages/:userId — get messages with a specific user
const getMessagesWithUser = async (req, res) => {
  const { userId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Verify there's an approved adoption relationship
    const { rows: adoptionRows } = await pool.query(
      `SELECT ar.id 
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       WHERE ar.status = 'approved' 
         AND ((p.owner_id = $1 AND ar.requester_id = $2) OR (p.owner_id = $2 AND ar.requester_id = $1))
       LIMIT 1`,
      [req.user.id, userId]
    );

    if (!adoptionRows.length) {
      return res.status(403).json({ message: 'No approved adoption relationship found.' });
    }

    const { rows } = await pool.query(
      `SELECT m.*, 
              sender.name AS sender_name, 
              sender.avatar_url AS sender_avatar,
              receiver.name AS receiver_name,
              receiver.avatar_url AS receiver_avatar
       FROM messages m
       JOIN users sender ON sender.id = m.sender_id
       JOIN users receiver ON receiver.id = m.receiver_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, userId, parseInt(limit), parseInt(offset)]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages SET is_read = TRUE 
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
      [userId, req.user.id]
    );

    res.json({ messages: rows.reverse() }); // Reverse to get chronological order
  } catch (err) {
    console.error('Get messages error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /api/messages/:id/read — mark message as read
const markAsRead = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE messages SET is_read = TRUE 
       WHERE id = $1 AND receiver_id = $2 AND is_read = FALSE
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Message not found or already read.' });
    }

    res.json({ message: 'Message marked as read.', message: rows[0] });
  } catch (err) {
    console.error('Mark as read error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/messages/unread/count — get unread message count
const getUnreadCount = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM messages WHERE receiver_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('Get unread count error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { sendMessage, getConversations, getMessagesWithUser, markAsRead, getUnreadCount };
