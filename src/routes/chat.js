const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  chat, createSession, sendMessage,
  listSessions, getSessionMessages, deleteSession,
} = require('../controllers/chatController');

// Stateless one-shot (no auth required)
router.post('/', chat);

// Persistent sessions
router.post('/sessions',                          optionalAuth, createSession);
router.get('/sessions',                           protect,      listSessions);
router.get('/sessions/:sessionId/messages',       protect,      getSessionMessages);
router.post('/sessions/:sessionId/messages',      optionalAuth, sendMessage);
router.delete('/sessions/:sessionId',             protect,      deleteSession);

module.exports = router;
