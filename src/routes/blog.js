const router = require('express').Router();
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const {
  listCategories, createCategory,
  listBlogs, getBlog, createBlog, updateBlog, deleteBlog,
  getComments, addComment, deleteComment,
} = require('../controllers/blogController');
const { blogCoverUploader } = require('../services/upload');

router.get('/categories',               listCategories);
router.post('/categories',              protect, adminOnly, createCategory);

router.get('/',                         optionalAuth, listBlogs);
router.get('/:slug',                    optionalAuth, getBlog);
router.post('/',                        protect, blogCoverUploader.single('cover'), createBlog);
router.patch('/:id',                    protect, blogCoverUploader.single('cover'), updateBlog);
router.delete('/:id',                   protect, deleteBlog);

router.get('/:id/comments',             getComments);
router.post('/:id/comments',            protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);

module.exports = router;