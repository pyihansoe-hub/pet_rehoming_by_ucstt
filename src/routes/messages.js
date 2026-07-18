const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  getUnreadCount,
  declineAndRefund
} = require('../controllers/messageController');

router.use(protect);

router.get('/unread-count',       getUnreadCount);
router.get('/conversations',      listConversations);
router.post('/conversations',     getOrCreateConversation);
router.get('/conversations/:id',  getMessages);
router.post('/conversations/:id', sendMessage);

// Refund & Pet Status update route
router.post('/conversations/:id/decline-and-refund', declineAndRefund);

module.exports = router;