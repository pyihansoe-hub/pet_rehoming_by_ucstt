// ── routes/auth.js — ADD these 3 lines to your existing auth routes ──────────
//
// const { forgotPassword, resetPassword, verifyResetToken } = require('../controllers/passwordResetController');
// router.post('/forgot-password',    forgotPassword);
// router.post('/reset-password',     resetPassword);
// router.get('/verify-reset-token',  verifyResetToken);


// ── routes/pet.js — ADD these 2 lines to your existing pet routes ─────────────
//
// const { getTrendingPets, getCities } = require('../controllers/trendingController');
// const { getPetStatusHistory }        = require('../services/petStatusHistory');
//
// router.get('/trending',         getTrendingPets);          // public
// router.get('/cities',           getCities);                // public
// router.get('/:id/status-history', protect, getPetStatusHistory);


// ── routes/adoption.js — ADD these 2 lines to your existing adoption routes ───
//
// const { agreeToAdoption, getAgreement } = require('../controllers/agreementController');
//
// router.get('/:id/agreement',       protect, getAgreement);
// router.patch('/:id/agreement/agree', protect, agreeToAdoption);


// ── NEW FILE: routes/messages.js ──────────────────────────────────────────────

const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  getUnreadCount,
} = require('../controllers/messageController');

router.use(protect);

router.get('/unread-count',          getUnreadCount);
router.get('/conversations',         listConversations);
router.post('/conversations',        getOrCreateConversation);
router.get('/conversations/:id',     getMessages);
router.post('/conversations/:id',    sendMessage);

module.exports = router;
