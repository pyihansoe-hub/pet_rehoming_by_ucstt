
const pool = require('../db/pool');
const { chat, chatStream } = require('../services/qwen');

// ── One-shot (no history, no stream) ─────────────────────────
// POST /api/chat
const chatOneShot = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  try {
    const reply = await chat([{ role: 'user', content: message.trim() }]);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ message: 'Chatbot error.', error: err.message });
  }
};

// ── One-shot streaming ────────────────────────────────────────
// GET /api/chat/stream?message=xxx
// Frontend uses EventSource to receive tokens word by word
const chatOneShotStream = async (req, res) => {
  const { message } = req.query;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    await chatStream([{ role: 'user', content: message.trim() }], res);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// ── Session management ────────────────────────────────────────

// POST /api/chat/sessions
const createSession = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { rows } = await pool.query(
      'INSERT INTO chat_sessions (user_id, title) VALUES ($1,$2) RETURNING *',
      [userId, 'New Chat']
    );
    res.status(201).json({ session: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/chat/sessions
const listSessions = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cs.*,
         (SELECT content FROM chat_messages WHERE session_id=cs.id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM chat_sessions cs
       WHERE cs.user_id=$1
       ORDER BY cs.updated_at DESC`,
      [req.user.id]
    );
    res.json({ sessions: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/chat/sessions/:sessionId/messages
const getSessionMessages = async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM chat_sessions WHERE id=$1', [req.params.sessionId]);
    if (!check.rows.length) return res.status(404).json({ message: 'Session not found.' });
    if (check.rows[0].user_id && check.rows[0].user_id !== req.user?.id)
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [req.params.sessionId]
    );
    res.json({ messages: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/chat/sessions/:sessionId/messages
// Standard (non-streaming) — saves history, returns full reply
const sendMessage = async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  try {
    const check = await pool.query('SELECT * FROM chat_sessions WHERE id=$1', [sessionId]);
    if (!check.rows.length) return res.status(404).json({ message: 'Session not found.' });
    if (check.rows[0].user_id && check.rows[0].user_id !== req.user?.id)
      return res.status(403).json({ message: 'Not authorized.' });

    // load history
    const { rows: history } = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [sessionId]
    );

    // save user message
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)',
      [sessionId, 'user', message.trim()]
    );

    // auto-title from first message
    if (!history.length) {
      const title = message.trim().slice(0, 60);
      await pool.query('UPDATE chat_sessions SET title=$1 WHERE id=$2', [title, sessionId]);
    }

    const messages = [...history, { role: 'user', content: message.trim() }];
    const reply = await chat(messages);

    // save assistant reply
    const { rows: saved } = await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3) RETURNING *',
      [sessionId, 'assistant', reply]
    );

    await pool.query('UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1', [sessionId]);

    res.json({ reply, message: saved[0] });
  } catch (err) {
    res.status(500).json({ message: 'Chatbot error.', error: err.message });
  }
};

// GET /api/chat/sessions/:sessionId/stream?message=xxx
// Streaming version — sends tokens via SSE, saves to DB when done
const sendMessageStream = async (req, res) => {
  const { sessionId } = req.params;
  const { message }   = req.query;

  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const check = await pool.query('SELECT * FROM chat_sessions WHERE id=$1', [sessionId]);
    if (!check.rows.length) {
      res.write(`data: ${JSON.stringify({ error: 'Session not found.' })}\n\n`);
      return res.end();
    }

    const { rows: history } = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [sessionId]
    );

    // save user message first
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)',
      [sessionId, 'user', message.trim()]
    );

    // auto-title
    if (!history.length) {
      await pool.query(
        'UPDATE chat_sessions SET title=$1 WHERE id=$2',
        [message.trim().slice(0, 60), sessionId]
      );
    }

    const messages = [...history, { role: 'user', content: message.trim() }];

    // stream and save when done
    await chatStream(messages, res, async (fullText) => {
      await pool.query(
        'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)',
        [sessionId, 'assistant', fullText]
      );
      await pool.query('UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1', [sessionId]);
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// DELETE /api/chat/sessions/:sessionId
const deleteSession = async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM chat_sessions WHERE id=$1', [req.params.sessionId]);
    if (!check.rows.length) return res.status(404).json({ message: 'Session not found.' });
    if (check.rows[0].user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM chat_sessions WHERE id=$1', [req.params.sessionId]);
    res.json({ message: 'Session deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = {
  chatOneShot,
  chatOneShotStream,
  createSession,
  listSessions,
  getSessionMessages,
  sendMessage,
  sendMessageStream,
  deleteSession,
};
