const router = require('express').Router();
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const { listCategories, createCategory, listBlogs, getBlog, createBlog, updateBlog, deleteBlog, getComments, addComment, deleteComment } = require('../controllers/blogController');
const { blogCoverUploader } = require('../services/upload');
const { validate, rules } = require('../middleware/validate');
const { ..., toggleLike } = require('../controllers/blogController');
router.post('/:id/like', protect, toggleLike);
router.get('/categories',                   listCategories);
router.post('/categories',                  protect, adminOnly, createCategory);
router.get('/',                             optionalAuth, listBlogs);
router.get('/:slug',                        optionalAuth, getBlog);
router.post('/',                            protect, blogCoverUploader.single('cover'), validate(rules.createBlog), createBlog);
router.patch('/:id',                        protect, blogCoverUploader.single('cover'), updateBlog);
router.delete('/:id',                       protect, deleteBlog);
router.get('/:id/comments',                 getComments);
router.post('/:id/comments',                protect, validate(rules.addComment), addComment);
router.delete('/:id/comments/:commentId',   protect, deleteComment);

module.exports = router;