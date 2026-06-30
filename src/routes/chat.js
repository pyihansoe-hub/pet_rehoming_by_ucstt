
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

// One-shot streaming (GET so EventSource can use it)
router.get('/stream',                         chatOneShotStream);

// Sessions
router.post('/sessions',                      optionalAuth, createSession);
router.get('/sessions',                       protect,      listSessions);
router.get('/sessions/:sessionId/messages',   protect,      getSessionMessages);
router.post('/sessions/:sessionId/messages',  optionalAuth, validate(rules.chatMessage), sendMessage);

// Streaming per session (GET for EventSource)
router.get('/sessions/:sessionId/stream',     optionalAuth, sendMessageStream);

router.delete('/sessions/:sessionId',         protect,      deleteSession);

module.exports = router;
