const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { addFavorite, removeFavorite, listFavorites } = require('../controllers/favoriteController');

router.use(protect);
router.get('/',         listFavorites);
router.post('/:petId',  addFavorite);
router.delete('/:petId', removeFavorite);

module.exports = router;