const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile, changePassword } = require('../controllers/userController');
const { avatarUploader } = require('../services/upload');
const { validate, rules } = require('../middleware/validate');

router.use(protect);
router.get('/profile',           getProfile);
router.patch('/profile',         avatarUploader.single('avatar'), validate(rules.updateProfile), updateProfile);
router.patch('/change-password', validate(rules.changePassword), changePassword);

module.exports = router;