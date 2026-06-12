const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile, changePassword } = require('../controllers/userController');
const { avatarUploader } = require('../services/upload');

router.use(protect);
router.get('/profile',           getProfile);
router.patch('/profile',         avatarUploader.single('avatar'), updateProfile);
router.patch('/change-password', changePassword);

module.exports = router;