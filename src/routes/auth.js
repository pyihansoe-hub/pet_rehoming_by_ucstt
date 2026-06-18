const router = require('express').Router();
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');
const { refreshToken, logout } = require('../controllers/tokenController');
const { validate, rules } = require('../middleware/validate');

router.post('/register', validate(rules.register), register);
router.post('/login',    validate(rules.login),    login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

module.exports = router;