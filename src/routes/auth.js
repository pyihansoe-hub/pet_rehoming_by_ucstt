const router = require('express').Router();
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');
const { validate, rules } = require('../middleware/validate');

router.post('/register', validate(rules.register), register);
router.post('/login',    validate(rules.login),    login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;