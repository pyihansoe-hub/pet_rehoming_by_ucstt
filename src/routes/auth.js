const router = require('express').Router();
const { register, login } = require('../controllers/authController');
const { validate, rules } = require('../middleware/validate');
const { forgotPassword, resetPassword, verifyResetToken } = require('../controllers/passwordResetController');

router.post('/forgot-password',    forgotPassword);
router.post('/reset-password',     resetPassword);
router.get('/verify-reset-token',  verifyResetToken);

router.post('/register', register);
router.post('/login',    validate(rules.login), login);

module.exports = router;