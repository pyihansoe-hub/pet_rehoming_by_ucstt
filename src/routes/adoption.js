const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { myRequests, receivedRequests, reviewRequest, cancelRequest } = require('../controllers/adoptionController');
router.use(protect);
router.get('/mine',         myRequests);
router.get('/received',     receivedRequests);
router.patch('/:id',        reviewRequest);
router.patch('/:id/cancel', cancelRequest);
module.exports = router;
