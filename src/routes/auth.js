const router = require('express').Router();
const { register, login, verifyTOTP, setup2FA, verify2FASetup } = require('../controllers/authController');
const { validate, rules } = require('../middleware/validate');
const { checkReset2FA, verifyReset2FA, completeReset2FA } = require('../controllers/passwordResetController');
const { protect } = require('../middleware/auth');

router.post('/reset/check', checkReset2FA);
router.post('/reset/verify-2fa', verifyReset2FA);
router.post('/reset/complete', completeReset2FA);

router.post('/register', register);
router.post('/login', validate(rules.login), login);
router.post('/verify-totp', verifyTOTP);

router.get('/2fa/setup', protect, setup2FA);
router.post('/2fa/verify', protect, verify2FASetup);

module.exports = router;