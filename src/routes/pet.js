const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  listPets, getPet, createPet, updatePet, deletePet,
  addPetImage, deletePetImage, myPets,
} = require('../controllers/petController');
const { requestAdoption } = require('../controllers/adoptionController');
const { petImageUploader } = require('../services/upload');

router.get('/my',                     protect,      myPets);
router.get('/',                       optionalAuth, listPets);
router.get('/:id',                    optionalAuth, getPet);
router.post('/',                      protect,      createPet);
router.patch('/:id',                  protect,      updatePet);
router.delete('/:id',                 protect,      deletePet);
router.post('/:id/images',            protect, petImageUploader.single('image'), addPetImage);
router.delete('/:id/images/:imageId', protect, deletePetImage);
router.post('/:id/adopt',             protect, requestAdoption);

module.exports = router;