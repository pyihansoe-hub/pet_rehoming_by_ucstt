const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { listNotifications, markAllRead, markRead, deleteNotification } = require('../controllers/notificationController');

router.use(protect);
router.get('/',               listNotifications);
router.patch('/read-all',     markAllRead);
router.patch('/:id/read',     markRead);
router.delete('/:id',         deleteNotification);

module.exports = router;