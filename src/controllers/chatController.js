const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const pool = require('../db/pool');

dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

const SYSTEM_PROMPT = "You are PawBot, a friendly and knowledgeable assistant for the Pet Rehoming platform.\nYou help users with:\n- Pet care advice for dogs, cats, rabbits, birds, fish, reptiles, hamsters, guinea pigs, and other animals\n- Adoption guidance and what to expect when rehoming a pet\n- General health and nutrition tips for pets\n- Training and behavioral advice\n- Answering questions about our platform (listing pets, requesting adoption, payments)\n\nKeep responses warm, helpful, and concise. If a question is outside pet/platform topics, you can still help politely as a general assistant.\nNever give medical diagnoses — always recommend consulting a vet for serious health concerns.";
// Helper function to call Gemini with history
async function callGemini(messages, systemPrompt) {
  // Gemini doesn't have a separate system prompt, so prepend it to the first user message
  let fullPrompt = systemPrompt + "\n\n";
  
  // Build conversation context
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    fullPrompt += '${role}: ${msg.content}\n';
  }
  
  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  return response.text();
}

// POST /api/chat  — stateless single message (no history saved)
const chat = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  try {
    const fullPrompt = '${SYSTEM_PROMPT}\n\nUser: ${message.trim()}\nAssistant:';
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const reply = response.text();

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ message: 'Chatbot error.', error: err.message });
  }
};

// POST /api/chat/sessions  — start a new session
const createSession = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { rows } = await pool.query(
      'INSERT INTO chat_sessions (user_id, title) VALUES ($1,$2) RETURNING *',
      [userId, 'New Chat']
    );
    res.status(201).json({ session: rows[0] });
  } catch (err) { 
    res.status(500).json({ message: 'Server error.', error: err.message }); 
  }
};

// POST /api/chat/sessions/:sessionId/messages  — send message in a session (history persisted)
const sendMessage = async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

  try {
    // Verify session ownership
    const sessCheck = await pool.query('SELECT * FROM chat_sessions WHERE id=$1', [sessionId]);
    if (!sessCheck.rows.length) return res.status(404).json({ message: 'Session not found.' });
    const session = sessCheck.rows[0];
    if (session.user_id && session.user_id !== req.user?.id)
      return res.status(403).json({ message: 'Not authorized.' });

    // Load history
    const { rows: history } = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [sessionId]
    );

    // Save user message
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)',
      [sessionId, 'user', message.trim()]
    );

    // Auto-title session from first message
    if (!history.length) {
      const title = message.trim().slice(0, 60);
      await pool.query('UPDATE chat_sessions SET title=$1 WHERE id=$2', [title, sessionId]);
    }

    // Prepare messages for Gemini
    const messages = [
      ...history,
      { role: 'user', content: message.trim() },
    ];
    // Call Gemini with conversation history
    let fullPrompt = SYSTEM_PROMPT + "\n\n";
    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      fullPrompt += '${role}: ${msg.content}\n';
    }
    fullPrompt += "Assistant:";

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const reply = response.text();

    // Save assistant reply
    const { rows: saved } = await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3) RETURNING *',
      [sessionId, 'assistant', reply]
    );
    
    res.json({ reply, message: saved[0] });
  } catch (err) {
    res.status(500).json({ message: 'Chatbot error.', error: err.message });
  }
};

// GET /api/chat/sessions  — list user's sessions
const listSessions = async (req, res) => {
 try {
  const { rows } = await pool.query('SELECT cs.*, (SELECT content FROM chat_messages WHERE session_id=cs.id ORDER BY created_at DESC LIMIT 1) AS last_message FROM chat_sessions cs WHERE cs.user_id=$1 ORDER BY cs.updated_at DESC', [req.user.id]);
  res.json({ sessions: rows });
} catch (err) { 
  res.status(500).json({ message: 'Server error.', error: err.message }); 
}
};

// GET /api/chat/sessions/:sessionId/messages  — get session history
const getSessionMessages = async (req, res) => {
  try {
    const sessCheck = await pool.query('SELECT user_id FROM chat_sessions WHERE id=$1', [req.params.sessionId]);
    if (!sessCheck.rows.length) return res.status(404).json({ message: 'Session not found.' });
    if (sessCheck.rows[0].user_id && sessCheck.rows[0].user_id !== req.user.id)
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [req.params.sessionId]
    );
    res.json({ messages: rows });
  } catch (err) { 
    res.status(500).json({ message: 'Server error.', error: err.message }); 
  }
};

// DELETE /api/chat/sessions/:sessionId
const deleteSession = async (req, res) => {
  try {
    const sessCheck = await pool.query('SELECT user_id FROM chat_sessions WHERE id=$1', [req.params.sessionId]);
    if (!sessCheck.rows.length) return res.status(404).json({ message: 'Session not found.' });
    if (sessCheck.rows[0].user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM chat_sessions WHERE id=$1', [req.params.sessionId]);
    res.json({ message: 'Session deleted.' });
  } catch (err) { 
    res.status(500).json({ message: 'Server error.', error: err.message }); 
  }
};

module.exports = { chat, createSession, sendMessage, listSessions, getSessionMessages, deleteSession };