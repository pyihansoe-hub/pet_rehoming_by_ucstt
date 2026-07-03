const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { listPets, getPet, createPet, updatePet, deletePet, addPetImage, deletePetImage, myPets,toggleLike, getComments, addComment, deleteComment } = require('../controllers/petController');
const { requestAdoption } = require('../controllers/adoptionController');
const { petImageUploader } = require('../services/upload');
const { validate, rules } = require('../middleware/validate');
const { getTrendingPets, getCities } = require('../controllers/trendingController');
const { getPetStatusHistory }        = require('../services/petStatusHistory');

router.get('/trending',         getTrendingPets);          // public
router.get('/cities',           getCities);                // public
router.get('/:id/status-history', protect, getPetStatusHistory);
router.get('/my',                         protect,      myPets);
router.get('/',                           optionalAuth, listPets);
router.get('/:id',                        optionalAuth, getPet);
router.post('/',                          protect, validate(rules.createPet), createPet);
router.patch('/:id',                      protect, updatePet);
router.delete('/:id',                     protect, deletePet);
router.post('/:id/images',                protect, petImageUploader.single('image'), addPetImage);
router.delete('/:id/images/:imageId',     protect, deletePetImage);
router.post('/:id/adopt',                 protect, validate(rules.requestAdoption), requestAdoption);
router.post('/:id/like',                 protect, toggleLike);
router.get('/:id/comments',               getComments);
router.post('/:id/comments',              protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);
module.exports = router;