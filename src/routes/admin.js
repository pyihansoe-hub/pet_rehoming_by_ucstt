const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getDashboardStats, listUsers, updateUserRole } = require('../controllers/adminController');

router.use(protect, adminOnly);
router.get('/stats',             getDashboardStats);
router.get('/users',             listUsers);
router.patch('/users/:id/role',  updateUserRole);

module.exports = router;