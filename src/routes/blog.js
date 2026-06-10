const router = require('express').Router();
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const {
  listCategories, createCategory,
  listBlogs, getBlog, createBlog, updateBlog, deleteBlog,
  getComments, addComment, deleteComment,
} = require('../controllers/blogController');

// Categories
router.get('/categories',        listCategories);
router.post('/categories',       protect, adminOnly, createCategory);

// Blogs
router.get('/',                  optionalAuth, listBlogs);
router.get('/:slug',             optionalAuth, getBlog);
router.post('/',                 protect,      createBlog);
router.patch('/:id',             protect,      updateBlog);
router.delete('/:id',            protect,      deleteBlog);

// Comments
router.get('/:id/comments',      getComments);
router.post('/:id/comments',     protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);

module.exports = router;
