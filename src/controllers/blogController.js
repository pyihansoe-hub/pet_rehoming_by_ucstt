const pool = require('../db/pool');

const slugify = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
  '-' + Date.now();

// ── Blog Categories ────────────────────────────────────────────────────────

const listCategories = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bc.*, pt.name AS pet_type_name FROM blog_categories bc
       LEFT JOIN pet_types pt ON pt.id=bc.pet_type_id ORDER BY bc.name`
    );
    res.json({ categories: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const createCategory = async (req, res) => {
  const { name, description, pet_type_id } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO blog_categories (name, slug, description, pet_type_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, slugify(name), description || null, pet_type_id || null]
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Category already exists.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── Blogs ──────────────────────────────────────────────────────────────────

const BLOG_SELECT = `
  b.*,
  u.name  AS author_name,
  u.avatar_url AS author_avatar,
  bc.name AS category_name,
  bc.slug AS category_slug,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name))
    FILTER (WHERE t.id IS NOT NULL), '[]'
  ) AS tags
FROM blogs b
JOIN users u ON u.id=b.author_id
LEFT JOIN blog_categories bc ON bc.id=b.category_id
LEFT JOIN blog_tags bt ON bt.blog_id=b.id
LEFT JOIN tags t ON t.id=bt.tag_id
`;

// GET /api/blogs
const listBlogs = async (req, res) => {
  const { category, pet_type, status = 'published', search, page = 1, limit = 20, tag } = req.query;
  const conditions = ['b.status = $1'];
  const values     = [status];
  let   i          = 2;

  if (category)   { conditions.push(`bc.slug = $${i++}`);              values.push(category); }
  if (pet_type)   { conditions.push(`bc.pet_type_id = $${i++}`);       values.push(pet_type); }
  if (search)     { conditions.push(`(b.title ILIKE $${i} OR b.summary ILIKE $${i})`); values.push(`%${search}%`); i++; }
  if (tag)        { conditions.push(`EXISTS(SELECT 1 FROM blog_tags bt2 JOIN tags t2 ON t2.id=bt2.tag_id WHERE bt2.blog_id=b.id AND t2.name ILIKE $${i++})`); values.push(tag); }

  const WHERE  = `WHERE ${conditions.join(' AND ')}`;
  const offset = (Math.max(1, page) - 1) * limit;

  try {
    const { rows } = await pool.query(
      `${BLOG_SELECT} ${WHERE} GROUP BY b.id, u.name, u.avatar_url, bc.name, bc.slug
       ORDER BY b.published_at DESC NULLS LAST, b.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(
      `SELECT COUNT(DISTINCT b.id) FROM blogs b
       LEFT JOIN blog_categories bc ON bc.id=b.category_id
       LEFT JOIN blog_tags bt ON bt.blog_id=b.id
       LEFT JOIN tags t ON t.id=bt.tag_id ${WHERE}`, values
    );
    res.json({ blogs: rows, total: parseInt(count.rows[0].count), page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/blogs/:slug
const getBlog = async (req, res) => {
  try {
    await pool.query('UPDATE blogs SET views=views+1 WHERE slug=$1', [req.params.slug]).catch(() => {});
    const { rows } = await pool.query(
      `${BLOG_SELECT} WHERE b.slug=$1 GROUP BY b.id, u.name, u.avatar_url, bc.name, bc.slug`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ message: 'Blog not found.' });
    res.json({ blog: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/blogs
const createBlog = async (req, res) => {
  const { title, content, summary, category_id, status = 'draft', tags = [] } = req.body;
  const cover_image_url = req.file ? '/uploads/blogs/${req.file.filename}' : null;
  if (!title || !content) return res.status(400).json({ message: 'Title and content are required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO blogs (author_id, category_id, title, slug, summary, content, cover_image_url, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, category_id || null, title, slugify(title), summary || null,
       content, cover_image_url || null, status,
       status === 'published' ? new Date() : null]
    );
    const blog = rows[0];

    // Handle tags
    for (const tagName of tags) {
      const trimmed = tagName.trim().toLowerCase();
      if (!trimmed) continue;
      let tagRow = await client.query('SELECT id FROM tags WHERE name=$1', [trimmed]);
      if (!tagRow.rows.length) {
        tagRow = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [trimmed]);
      }
      await client.query('INSERT INTO blog_tags (blog_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [blog.id, tagRow.rows[0].id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Blog created.', blog });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};

// PATCH /api/blogs/:id
const updateBlog = async (req, res) => {
  const { title, content, summary, category_id, status, tags } = req.body;
  const cover_image_url = req.file ? '/uploads/blogs/${req.file.filename}' : undefined;

  try {
    const check = await pool.query('SELECT author_id, status FROM blogs WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ message: 'Blog not found.' });
    if (check.rows[0].author_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const fields = []; const values = []; let i = 1;
    if (title)          { fields.push(`title=$${i++}`);           values.push(title); }
    if (content)        { fields.push(`content=$${i++}`);         values.push(content); }
    if (summary)        { fields.push(`summary=$${i++}`);         values.push(summary); }
    if (category_id)    { fields.push(`category_id=$${i++}`);     values.push(category_id); }
    if (cover_image_url !== undefined) { fields.push('cover_image_url=$${i++}'); values.push(cover_image_url); }
    // if (cover_image_url){ fields.push(`cover_image_url=$${i++}`); values.push(cover_image_url); }
    if (status) {
      fields.push(`status=$${i++}`); values.push(status);
      if (status === 'published' && check.rows[0].status !== 'published') {
        fields.push(`published_at=$${i++}`); values.push(new Date());
      }
    }

    if (fields.length) {
      values.push(req.params.id);
      await pool.query(`UPDATE blogs SET ${fields.join(',')} WHERE id=$${i}`, values);
    }

    if (Array.isArray(tags)) {
      await pool.query('DELETE FROM blog_tags WHERE blog_id=$1', [req.params.id]);
      for (const tagName of tags) {
        const trimmed = tagName.trim().toLowerCase();
        if (!trimmed) continue;
        let tagRow = await pool.query('SELECT id FROM tags WHERE name=$1', [trimmed]);
        if (!tagRow.rows.length) tagRow = await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [trimmed]);
        await pool.query('INSERT INTO blog_tags (blog_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, tagRow.rows[0].id]);
      }
    }

    res.json({ message: 'Blog updated.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/blogs/:id
const deleteBlog = async (req, res) => {
  try {
    const check = await pool.query('SELECT author_id FROM blogs WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ message: 'Blog not found.' });
    if (check.rows[0].author_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM blogs WHERE id=$1', [req.params.id]);
    res.json({ message: 'Blog deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Comments ───────────────────────────────────────────────────────────────

const getComments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bc.*, u.name AS user_name, u.avatar_url FROM blog_comments bc
       JOIN users u ON u.id=bc.user_id
       WHERE bc.blog_id=$1 ORDER BY bc.created_at ASC`,
      [req.params.id]
    );
    res.json({ comments: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const addComment = async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Comment content is required.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO blog_comments (blog_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, req.user.id, content.trim()]
    );
    res.status(201).json({ comment: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const deleteComment = async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM blog_comments WHERE id=$1', [req.params.commentId]);
    if (!check.rows.length) return res.status(404).json({ message: 'Comment not found.' });
    if (check.rows[0].user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM blog_comments WHERE id=$1', [req.params.commentId]);
    res.json({ message: 'Comment deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = {
  listCategories, createCategory,
  listBlogs, getBlog, createBlog, updateBlog, deleteBlog,
  getComments, addComment, deleteComment,
};
