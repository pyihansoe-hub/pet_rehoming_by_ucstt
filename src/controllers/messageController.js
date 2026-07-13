const pool = require('../db/pool');

// Helper — check user is owner or adopter of adoption request
const getConversationAccess = async (conversationId, userId, role) => {
  if (role === 'admin') return { allowed: true };
  const { rows } = await pool.query(
    `SELECT ar.requester_id, p.owner_id
     FROM conversations c
     JOIN adoption_requests ar ON ar.id=c.adoption_request_id
     JOIN pets p ON p.id=ar.pet_id
     WHERE c.id=$1`,
    [conversationId]
  );
  if (!rows.length) return { allowed: false, notFound: true };
  const allowed = rows[0].requester_id === userId || rows[0].owner_id === userId;
  return { allowed, participants: rows[0] };
};

// POST /api/messages/conversations
// Create conversation when adoption is approved (or get existing)
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

    // get or create
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
// List all conversations for logged-in user
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

    // mark all messages from other party as read
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
// DELETE /api/messages/conversations/:id
const deleteConversation = async (req, res) => {
  try {
    const access = await getConversationAccess(req.params.id, req.user.id, req.user.role);
    if (access.notFound) return res.status(404).json({ message: 'Conversation not found.' });
    if (!access.allowed) return res.status(403).json({ message: 'Not authorized.' });

    await pool.query('DELETE FROM conversations WHERE id = $1', [req.params.id]);
    res.json({ ok: true, message: 'Conversation deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
module.exports = { getOrCreateConversation, listConversations, getMessages, sendMessage, getUnreadCount, deleteConversation};
