const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { initiatePayment, verifyPayment, ayaWebhook, listPayments, getPayment } = require('../controllers/paymentController');
const { validate, rules } = require('../middleware/validate');

router.use(protect);
router.get('/',            listPayments);
router.get('/:id',         getPayment);
router.post('/initiate',   validate(rules.initiatePayment), initiatePayment);
router.post('/:id/verify', verifyPayment);

// Webhook endpoint (no auth required - called by Aya Pay directly)
router.post('/webhook/aya', ayaWebhook);

module.exports = router;