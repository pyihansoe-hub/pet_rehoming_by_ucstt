const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile, changePassword } = require('../controllers/userController');
router.use(protect);
router.get('/profile',           getProfile);
router.patch('/profile',         updateProfile);
router.patch('/change-password', changePassword);
module.exports = router;
