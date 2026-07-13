const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  getUnreadCount,
  deleteConversation
} = require('../controllers/messageController');

router.use(protect);

router.get('/unread-count',       getUnreadCount);
router.get('/conversations',      listConversations);
router.post('/conversations',     getOrCreateConversation);
router.get('/conversations/:id',  getMessages);
router.post('/conversations/:id', sendMessage);
router.delete('/conversations/:id', deleteConversation);
module.exports = router;
