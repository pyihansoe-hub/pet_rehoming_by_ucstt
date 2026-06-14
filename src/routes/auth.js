const router = require('express').Router();
const { register, login } = require('../controllers/authController');
const { validate, rules } = require('../middleware/validate');

router.post('/register', validate(rules.register), register);
router.post('/login',    validate(rules.login),    login);

module.exports = router;