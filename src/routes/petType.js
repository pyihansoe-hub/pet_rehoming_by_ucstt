const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { listPetTypes, createPetType, deletePetType } = require('../controllers/petTypeController');
router.get('/',     listPetTypes);
router.post('/',    protect, adminOnly, createPetType);
router.delete('/:id', protect, adminOnly, deletePetType);
module.exports = router;
