const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { submitReport, listReports, resolveReport } = require('../controllers/reportController');

router.post('/',       protect, submitReport);
router.get('/',        protect, adminOnly, listReports);
router.patch('/:id',   protect, adminOnly, resolveReport);

module.exports = router;