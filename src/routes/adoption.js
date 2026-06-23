const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { myRequests, receivedRequests, reviewRequest, cancelRequest } = require('../controllers/adoptionController');

const { agreeToAdoption, getAgreement } = require('../controllers/agreementController');

router.get('/:id/agreement',       protect, getAgreement);
router.patch('/:id/agreement/agree', protect, agreeToAdoption);
router.use(protect);
router.get('/mine',         myRequests);
router.get('/received',     receivedRequests);
router.patch('/:id',        reviewRequest);
router.patch('/:id/cancel', cancelRequest);
module.exports = router;
