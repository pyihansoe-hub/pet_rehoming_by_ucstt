const pool = require('../db/pool');
const { chat, chatStream } = require('../services/qwen');

const SYSTEM_PROMPT = `You are PawBot, a helpful assistant for a Myanmar pet adoption website.
If the user is looking to find, search, or adopt a pet, you MUST start your response with a hidden JSON block wrapped in <filters></filters> tags.
The JSON keys can be: "type", "gender", "fee", "city", "search".

IMPORTANT RULES FOR VALUES:
- "type" MUST be in English exactly: "Dog", "Cat", or "Other".
- "gender" MUST be in English exactly: "male" or "female".
- "fee" MUST be in English exactly: "free" or "paid".
- "city" MUST be in Burmese, exactly matching one of these: ရန်ကုန်, ကမောက်ကမ, ရဟန်း, ဗဟန်း, မရမ်းကုန်း, လှိုင်, သာကေတ, ရေကျော်, ဒေါပုံ, ကမရွတ်, စမ်းချောင်း, မန္တလေး, ပြင်ဦးလွင်, ပြည်ကြီးတံခွန်, နေပြည်တော်, ပြင်မနား, တောင်ကြီး, မကွေး, ပြည်, စစ်ကိုင်း, ပုသိမ်, မော်လမြိုင်, ပဲခူး, မိတ္ထီလာ, တောင်ငူ, စစ်တွေ, သထုံ, မြိတ်.
- "search" should contain any specific pet name (e.g., "Tom") or breed (e.g., "Golden Retriever", "Husky") the user mentions.

Only include keys that the user explicitly mentioned.
Example 1: User says "ရန်ကုန်မှာ အခမဲ့ ခွေးလေးတွေ ရှိလား" -> <filters>{"type":"Dog","fee":"free","city":"ရန်ကုန်"}</filters>
Example 2: User says "မန္တလေးမှာ အမကြောင်လေးတွေ ပြပါ" -> <filters>{"type":"Cat","gender":"female","city":"မန္တလေး"}</filters>
Example 3: User says "Husky မျိုးစိတ် ခွေးတွေ ရှိလား" -> <filters>{"type":"Dog","search":"Husky"}</filters>
Example 4: User says "Tom နဲ့ ခွေးလေးတွေ ပြပါ" -> <filters>{"search":"Tom"}</filters>

After the JSON block, write a short friendly Burmese message telling them you are showing the results below.
If the user is NOT looking for a pet (e.g., asking for care tips), just answer normally in Burmese without any filter block.`;

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
// POST /api/chat/stream
const chatOneShotStream = async (req, res) => {
  // POST request မှ messages array ကို လှမ်းယူခြင်း
  const { messages } = req.body;
  const message = messages?.[0]?.content;

  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: message.trim() }
];
await chatStream(messages, res);
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
const sendMessage = async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  try {
    const check = await pool.query('SELECT * FROM chat_sessions WHERE id=$1', [sessionId]);
    if (!check.rows.length) return res.status(404).json({ message: 'Session not found.' });
    if (check.rows[0].user_id && check.rows[0].user_id !== req.user?.id)
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows: history } = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [sessionId]
    );

    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)',
      [sessionId, 'user', message.trim()]
    );

    if (!history.length) {
      const title = message.trim().slice(0, 60);
      await pool.query('UPDATE chat_sessions SET title=$1 WHERE id=$2', [title, sessionId]);
    }

    const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...history,
  { role: 'user', content: message.trim() }
];
    const reply = await chat(messages);

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

// ── Streaming per session ────────────────────────────────────
// POST /api/chat/sessions/:sessionId/stream
const sendMessageStream = async (req, res) => {
  const { sessionId } = req.params;
  
  // POST request မှ messages array ကို လှမ်းယူခြင်း
  const { messages: reqMessages } = req.body;
  const message = reqMessages?.[0]?.content;

  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
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

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message.trim() }
    ];

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