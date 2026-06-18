const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  submitFollowup, getFollowups, getMyDueFollowups,
  addHealthLog, getHealthLogs, deleteHealthLog,
} = require('../controllers/monitoringController');
const { petImageUploader } = require('../services/upload');

// Follow-ups
router.post('/followups/:adoptionRequestId',        protect, petImageUploader.single('image'), submitFollowup);
router.get('/followups/:adoptionRequestId',         protect, getFollowups);
router.get('/followups/my-due',                     protect, getMyDueFollowups);

// Health logs
router.post('/pets/:petId/health-logs',             protect, addHealthLog);
router.get('/pets/:petId/health-logs',              optionalAuth, getHealthLogs);
router.delete('/pets/:petId/health-logs/:logId',    protect, deleteHealthLog);

module.exports = router;