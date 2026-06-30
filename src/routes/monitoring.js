/**
 * Replace your existing src/routes/monitoring.js with this file.
 */

const router  = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  myAdoptions,
  myRehomed,
  getTimeline,
  submitFollowup,
  getFollowups,
  addHealthLog,
  getHealthLogs,
  deleteHealthLog,
  resolveFlag,
  listFlags,
} = require('../controllers/monitoringController');
const { petImageUploader } = require('../services/upload');

// ── Adopter views ─────────────────────────────────────────────
router.get('/my-adoptions',                              protect, myAdoptions);

// ── Owner views ───────────────────────────────────────────────
router.get('/rehomed',                                   protect, myRehomed);

// ── Timeline (owner + adopter + admin) ───────────────────────
router.get('/timeline/:adoptionRequestId',               protect, getTimeline);

// ── Follow-ups ────────────────────────────────────────────────
router.post('/followups/:adoptionRequestId',             protect, petImageUploader.single('image'), submitFollowup);
router.get('/followups/:adoptionRequestId',              protect, getFollowups);

// ── Health logs ───────────────────────────────────────────────
router.post('/pets/:petId/health-logs',                  protect, addHealthLog);
router.get('/pets/:petId/health-logs',                   protect, getHealthLogs);
router.delete('/pets/:petId/health-logs/:logId',         protect, deleteHealthLog);

// ── Welfare flags (admin) ─────────────────────────────────────
router.get('/flags',                                     protect, adminOnly, listFlags);
router.patch('/flags/:flagId/resolve',                   protect, adminOnly, resolveFlag);

module.exports = router;
