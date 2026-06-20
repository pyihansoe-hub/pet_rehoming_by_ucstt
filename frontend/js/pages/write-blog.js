// js/pages/write-blog.js - Write/Edit Blog Logic

async function renderWriteBlog() {
    renderBlogForm();
}

async function renderEditBlog(blogId) {
    window.utils.showLoading();
    try {
        // We need the full object, but getBlogBySlug returns it. 
        // If we only have ID, we might need a getById endpoint or fetch all and find.
        // Assuming we can fetch by ID or Slug. Let's assume we fetch by ID via a helper or existing logic.
        // For now, let's use a generic fetch or assume the ID is enough for a PATCH.
        // Actually, the guide says GET /api/blogs/:slug. Let's fetch all and find or assume we have a way.
        // To keep it simple, let's fetch the list and find the one with matching ID, or better, 
        // let's assume the admin/owner knows the slug or we have a getById. 
        // Since the guide doesn't specify getById for blogs, let's use the slug from the URL if available, 
        // or fetch the list. 
        // *Correction*: The guide says GET /api/blogs/:slug. Let's assume the edit link passes the slug or ID.
        // If it passes ID, we might need to fetch the list. Let's assume for this demo we fetch the list.
        
        const allBlogs = await API.getBlogs({ limit: 100 }); 
        const blog = allBlogs.data.find(b => b.id == blogId);
        
        if (!blog) throw new Error('Blog not found');
        renderBlogForm(blog);
    } catch (error) {
        window.utils.hideLoading();
        window.utils.showToast('Failed to load blog', 'error');
    }
}

async function renderBlogForm(blog = null) {
    const isEdit = !!blog;
    const mainContent = document.getElementById('main-content');
    
    const categories = await API.getBlogCategories();

    mainContent.innerHTML = `
        <div class="container mt-lg">
            <div class="card" style="max-width: 800px; margin: 0 auto;">
                <h2>${isEdit ? 'Edit Blog Post' : 'Write New Post'}</h2>
                <form id="blog-form">
                    <div class="form-group">
                        <label class="form-label">Title *</label>
                        <input type="text" id="blog-title" class="form-input" value="${blog?.title || ''}" required>
                    </div>
                    
                    <div class="grid grid-2 gap-md">
                        <div class="form-group">                            <label class="form-label">Category *</label>
                            <select id="blog-cat-id" class="form-select" required>
                                <option value="">Select Category</option>
                                ${categories.map(c => `<option value="${c.id}" ${blog?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="blog-status" class="form-select">
                                <option value="draft" ${blog?.status === 'draft' ? 'selected' : ''}>Draft</option>
                                <option value="published" ${blog?.status === 'published' ? 'selected' : ''}>Published</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Summary</label>
                        <textarea id="blog-summary" class="form-textarea" rows="3">${blog?.summary || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Content (HTML allowed) *</label>
                        <textarea id="blog-content" class="form-textarea" rows="15" required>${blog?.content || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tags (comma separated)</label>
                        <input type="text" id="blog-tags" class="form-input" value="${blog?.tags?.join(', ') || ''}" placeholder="dog, care, training">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Cover Image</label>
                        <input type="file" id="blog-cover" class="form-input" accept="image/*">
                        ${blog?.cover_image ? `<img src="${window.utils.getImageUrl(blog.cover_image)}" style="max-height: 100px; margin-top: 10px;">` : ''}
                    </div>

                    <div class="flex gap-md mt-lg">
                        <button type="submit" class="btn btn-primary btn-lg" style="flex: 1;">${isEdit ? 'Update Post' : 'Publish Post'}</button>
                        ${isEdit ? `<button type="button" onclick="handleDeleteBlog(${blog.id})" class="btn btn-danger btn-lg">Delete</button>` : ''}
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('blog-form').addEventListener('submit', (e) => handleBlogSubmit(e, isEdit, blog?.id));
}

async function handleBlogSubmit(e, isEdit, blogId) {
    e.preventDefault();    
    const formData = new FormData();
    formData.append('title', document.getElementById('blog-title').value);
    formData.append('category_id', document.getElementById('blog-cat-id').value);
    formData.append('status', document.getElementById('blog-status').value);
    formData.append('summary', document.getElementById('blog-summary').value);
    formData.append('content', document.getElementById('blog-content').value);
    
    // Tags as JSON string
    const tagsInput = document.getElementById('blog-tags').value;
    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(t => t);
    formData.append('tags', JSON.stringify(tagsArray));

    const coverFile = document.getElementById('blog-cover').files[0];
    if (coverFile) {
        formData.append('cover', coverFile);
    }

    window.utils.showLoading();
    try {
        if (isEdit) {
            await API.updateBlog(blogId, formData);
            window.utils.showToast('Blog updated!', 'success');
            // Redirect to detail page (need slug, but we might not have it yet if changed. 
            // For simplicity, redirect to blog list or fetch the updated blog to get slug)
            setTimeout(() => window.location.hash = '/blogs', 1000);
        } else {
            const newBlog = await API.createBlog(formData);
            window.utils.showToast('Blog created!', 'success');
            setTimeout(() => window.location.hash = `/blogs/${newBlog.slug}`, 1000);
        }
    } catch (error) {
        window.utils.showToast(error.message || 'Operation failed', 'error');
    } finally {
        window.utils.hideLoading();
    }
}

async function handleDeleteBlog(blogId) {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    
    window.utils.showLoading();
    try {
        await API.deleteBlog(blogId);
        window.utils.showToast('Blog deleted', 'success');
        setTimeout(() => window.location.hash = '/blogs', 1000);
    } catch (error) {
        window.utils.hideLoading();
        window.utils.showToast(error.message || 'Delete failed', 'error');
    }}
