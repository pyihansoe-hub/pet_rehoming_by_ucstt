const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  chatOneShot,
  chatOneShotStream,
  createSession,
  listSessions,
  getSessionMessages,
  sendMessage,
  sendMessageStream,
  deleteSession,
} = require('../controllers/chatController');
const { validate, rules } = require('../middleware/validate');

// One-shot — no history
router.post('/',                              validate(rules.chatMessage), chatOneShot);

// One-shot streaming (POST for fetch API)
router.post('/stream',                        chatOneShotStream); // Changed to POST

// Sessions
router.post('/sessions',                      optionalAuth, createSession);
router.get('/sessions',                       protect,      listSessions);
router.get('/sessions/:sessionId/messages',   protect,      getSessionMessages);
router.post('/sessions/:sessionId/messages',  optionalAuth, validate(rules.chatMessage), sendMessage);

// Streaming per session (POST for fetch API)
router.post('/sessions/:sessionId/stream',    optionalAuth, sendMessageStream); // Changed to POST

router.delete('/sessions/:sessionId',         protect,      deleteSession);

module.exports = router;