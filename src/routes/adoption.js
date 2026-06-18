const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { requestAdoption, myRequests, receivedRequests, reviewRequest, cancelRequest, agreeContract, getContract, getContactInfo } = require('../controllers/adoptionController');

// Note: requestAdoption is in pet routes as POST /api/pets/:id/adopt
router.use(protect);
router.get('/mine',                    myRequests);
router.get('/received',                receivedRequests);
router.patch('/:id',                   reviewRequest);
router.patch('/:id/cancel',            cancelRequest);
router.post('/:id/agree-contract',     agreeContract);
router.get('/:id/contract',            getContract);
router.get('/:id/contact-info',        getContactInfo); // Contact reveal logic

module.exports = router;
