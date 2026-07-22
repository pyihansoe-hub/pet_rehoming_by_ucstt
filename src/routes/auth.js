const router = require('express').Router();
const { register, login, verifyTOTP } = require('../controllers/authController');
const { validate, rules } = require('../middleware/validate');

// Import the new 2FA password reset functions
const { checkReset2FA, verifyReset2FA, completeReset2FA } = require('../controllers/passwordResetController');

// 2FA Password Reset Routes
router.post('/reset/check',       checkReset2FA);
router.post('/reset/verify-2fa',  verifyReset2FA);
router.post('/reset/complete',    completeReset2FA);

// Regular Auth Routes
router.post('/register', register);
router.post('/login',    validate(rules.login), login);
router.post('/verify-totp', verifyTOTP);

module.exports = router;