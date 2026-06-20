// js/pages/blog-detail.js - Blog Detail Page Logic

async function renderBlogDetail(slug) {
    const mainContent = document.getElementById('main-content');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <div class="flex-center" style="min-height: 300px;">
                <div class="spinner"></div>
            </div>
        </div>
    `;

    try {
        const blog = await API.getBlogBySlug(slug);
        
        const coverUrl = blog.cover_image ? window.utils.getImageUrl(blog.cover_image) : '/placeholder.png';

        const contentHTML = `
            <article class="card mb-lg">
                <div style="height: 300px; background-image: url('${coverUrl}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);"></div>
                
                <div class="flex-between mb-md">
                    <span class="status-pill status-published">${blog.category?.name || 'General'}</span>
                    <div class="flex gap-sm">
                        <span class="text-muted">👁️ ${blog.views} views</span>
                        <button onclick="handleLikeBlog(${blog.id})" class="btn btn-sm btn-outline">
                            ❤️ ${blog.like_count || 0} Likes
                        </button>
                    </div>
                </div>

                <h1>${blog.title}</h1>
                <div class="flex gap-md text-muted mb-lg">
                    <span>By ${blog.author?.name || 'Admin'}</span>
                    <span>•</span>
                    <span>${window.utils.formatDate(blog.published_at)}</span>
                </div>

                <div class="blog-content" style="line-height: 1.8; font-size: 1.1rem;">
                    ${blog.content}
                </div>

                <div class="mt-lg">
                    <strong>Tags:</strong> 
                    ${blog.tags?.map(tag => `<span class="chip text-sm">${tag}</span>`).join(' ') || 'None'}
                </div>
            </article>
            <!-- Comments Section -->
            <div class="card">
                <h3>Comments (${blog.comments?.length || 0})</h3>
                
                ${user ? `
                    <form id="comment-form" class="mt-md mb-lg">
                        <textarea id="comment-content" class="form-textarea" placeholder="Write a comment..." required></textarea>
                        <button type="submit" class="btn btn-primary mt-sm">Post Comment</button>
                    </form>
                ` : `
                    <p class="text-muted mt-md"><a href="/#login">Login</a> to leave a comment.</p>
                `}

                <div id="comments-list" class="mt-lg">
                    ${blog.comments?.map(c => renderComment(c, user)).join('') || '<p class="text-muted">No comments yet.</p>'}
                </div>
            </div>
        `;

        mainContent.innerHTML = contentHTML;

        if (user) {
            document.getElementById('comment-form').addEventListener('submit', (e) => handleAddComment(e, blog.id));
        }

    } catch (error) {
        mainContent.innerHTML = `<div class="container"><h2>Blog post not found.</h2></div>`;
    }
}

function renderComment(comment, currentUser) {
    const isOwner = currentUser && currentUser.id === comment.user_id;
    return `
        <div class="mb-md pb-md" style="border-bottom: 1px solid var(--border-color);">
            <div class="flex-between">
                <strong>${comment.user_name}</strong>
                <span class="text-muted text-sm">${window.utils.formatDate(comment.created_at)}</span>
            </div>
            <p class="mt-sm">${comment.content}</p>
            ${isOwner ? `<button onclick="deleteComment(${comment.blog_id}, ${comment.id})" class="btn btn-sm btn-danger mt-sm">Delete</button>` : ''}
        </div>
    `;
}

async function handleLikeBlog(blogId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.utils.showToast('Please login to like posts', 'error');
        return;
    }
    try {
        const result = await API.likeBlog(blogId);
        // Re-render just the button or the whole page? For simplicity, let's update the button text
        const btn = document.querySelector('button[onclick^="handleLikeBlog"]');
        if (btn) {
            btn.innerHTML = `❤️ ${result.like_count || 0} Likes`;
            window.utils.showToast(result.liked ? 'Liked!' : 'Unliked', 'info');
        }
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to like', 'error');
    }
}

async function handleAddComment(e, blogId) {
    e.preventDefault();
    const content = document.getElementById('comment-content').value;
    
    try {
        await API.addComment(blogId, { content });
        window.utils.showToast('Comment posted!', 'success');
        // Reload the blog to show new comment
        const slug = window.location.pathname.split('/').pop();
        renderBlogDetail(slug);
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to post comment', 'error');
    }
}

async function deleteComment(blogId, commentId) {
    if (!confirm('Delete this comment?')) return;
    try {
        await API.deleteComment(blogId, commentId);
        window.utils.showToast('Comment deleted', 'success');
        const slug = window.location.pathname.split('/').pop();
        renderBlogDetail(slug);
    } catch (error) {
        window.utils.showToast(error.message || 'Delete failed', 'error');
    }
}