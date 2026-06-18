const router = require('express').Router();
const { sendMessage, getConversations, getMessagesWithUser, markAsRead, getUnreadCount } = require('../controllers/messageController');
const { protect: auth } = require('../middleware/auth');

// All message routes require authentication
router.use(auth);

// POST /api/messages/send — send a message
router.post('/send', sendMessage);

// GET /api/messages/conversations — get all conversations
router.get('/conversations', getConversations);

// GET /api/messages/unread/count — get unread count
router.get('/unread/count', getUnreadCount);

// GET /api/messages/:userId — get messages with specific user
router.get('/:userId', getMessagesWithUser);

// PATCH /api/messages/:id/read — mark message as read
router.patch('/:id/read', markAsRead);

module.exports = router;
