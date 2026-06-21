const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  listPets, getPet, createPet, updatePet, deletePet,
  addPetImage, deletePetImage, myPets, getTrendingPets, getCities
} = require('../controllers/petController');
const { requestAdoption } = require('../controllers/adoptionController');
const { petImageUploader } = require('../services/upload');
const { validate, rules } = require('../middleware/validate');

router.get('/my',                         protect,      myPets);
router.get('/trending',                   optionalAuth, getTrendingPets);
router.get('/cities',                     optionalAuth, getCities);
router.get('/',                           optionalAuth, listPets);
router.get('/:id',                        optionalAuth, getPet);
router.post('/',                          protect, validate(rules.createPet), createPet);
router.patch('/:id',                      protect, updatePet);
router.delete('/:id',                     protect, deletePet);
router.post('/:id/images',                protect, petImageUploader.single('image'), addPetImage);
router.delete('/:id/images/:imageId',     protect, deletePetImage);
router.post('/:id/adopt',                 protect, validate(rules.requestAdoption), requestAdoption);

module.exports = router;
