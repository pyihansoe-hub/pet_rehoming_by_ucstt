const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getDashboardStats,
  listUsers, getUser, updateUserRole, suspendUser, unsuspendUser, deleteUser,
  listAllPets, deletePet, updatePetStatus,
  listAllBlogs, deleteBlog, updateBlogStatus,
  listAllAdoptions, closeAdoption,
  listAllFollowups, listAllHealthLogs,
  getAuditLog,
  listReports, resolveReport,
} = require('../controllers/adminController');

// All admin routes require login + admin role
router.use(protect, adminOnly);

// Dashboard
router.get('/stats',                    getDashboardStats);

// Users
router.get('/users',                    listUsers);
router.get('/users/:id',                getUser);
router.patch('/users/:id/role',         updateUserRole);
router.patch('/users/:id/suspend',      suspendUser);
router.patch('/users/:id/unsuspend',    unsuspendUser);
router.delete('/users/:id',             deleteUser);

// Pets
router.get('/pets',                     listAllPets);
router.delete('/pets/:id',              deletePet);
router.patch('/pets/:id/status',        updatePetStatus);

// Blogs
router.get('/blogs',                    listAllBlogs);
router.delete('/blogs/:id',             deleteBlog);
router.patch('/blogs/:id/status',       updateBlogStatus);

// Adoptions
router.get('/adoptions',                listAllAdoptions);
router.patch('/adoptions/:id/close',    closeAdoption);

// Monitoring
router.get('/followups',                listAllFollowups);
router.get('/health-logs',              listAllHealthLogs);

// Audit log
router.get('/audit-log',                getAuditLog);

// Reports
router.get('/reports',                  listReports);
router.patch('/reports/:id/resolve',    resolveReport);

module.exports = router;
