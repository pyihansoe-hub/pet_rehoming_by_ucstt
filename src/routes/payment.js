const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { initiatePayment, verifyPayment, listPayments, getPayment } = require('../controllers/paymentController');
router.use(protect);
router.get('/',            listPayments);
router.get('/:id',         getPayment);
router.post('/initiate',   initiatePayment);
router.post('/:id/verify', verifyPayment);
module.exports = router;
