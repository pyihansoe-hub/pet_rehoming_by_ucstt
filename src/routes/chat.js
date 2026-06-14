const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { chat, createSession, sendMessage, listSessions, getSessionMessages, deleteSession } = require('../controllers/chatController');
const { validate, rules } = require('../middleware/validate');

router.post('/',                             validate(rules.chatMessage), chat);
router.post('/sessions',                     optionalAuth, createSession);
router.get('/sessions',                      protect, listSessions);
router.get('/sessions/:sessionId/messages',  protect, getSessionMessages);
router.post('/sessions/:sessionId/messages', optionalAuth, validate(rules.chatMessage), sendMessage);
router.delete('/sessions/:sessionId',        protect, deleteSession);

module.exports = router;