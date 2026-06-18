// Blog Page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    await loadBlogCategories();
    await loadBlogPosts();
});

// Load blog categories
async function loadBlogCategories() {
    try {
        // Note: You may need to add a categories endpoint to your API
        // For now, using hardcoded common categories
        const categories = [
            { id: 1, name: 'Dog Care' },
            { id: 2, name: 'Cat Care' },
            { id: 3, name: 'Health & Vet' },
            { id: 4, name: 'Training' },
            { id: 5, name: 'Nutrition' },
            { id: 6, name: 'General' }
        ];
        
        const select = document.getElementById('categoryFilter');
        select.innerHTML += categories.map(cat => 
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Load blog posts
async function loadBlogPosts() {
    const container = document.getElementById('blogContainer');
    const categoryId = document.getElementById('categoryFilter').value;
    
    container.innerHTML = '<div class="loading">Loading blog posts...</div>';
    
    try {
        const filters = {};
        if (categoryId) filters.category_id = categoryId;
        
        const response = await api.blog.list(filters);
        
        if (!response.blogs || response.blogs.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No blog posts found.</p>';
            return;
        }
        
        container.innerHTML = response.blogs.map(blog => `
            <article class="pet-card" style="cursor: pointer;" onclick="viewBlogPost(${blog.id})">
                <img src="${blog.cover_image_url || 'https://via.placeholder.com/350x200?text=Blog+Post'}" 
                     alt="${blog.title}" 
                     class="pet-image"
                     onerror="this.src='https://via.placeholder.com/350x200?text=No+Image'">
                <div class="pet-info">
                    <h3 class="pet-name">${blog.title}</h3>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 10px;">
                        By ${blog.author_name} • ${formatDate(blog.published_at || blog.created_at)}
                    </p>
                    <p style="color: #888; font-size: 0.85rem;">
                        ${blog.summary ? blog.summary.substring(0, 150) + '...' : blog.content.substring(0, 150) + '...'}
                    </p>
                    <div style="margin-top: 15px;">
                        <span class="pet-badge">📖 ${blog.views} reads</span>
                    </div>
                </div>
            </article>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load blog posts: ${error.message}</div>`;
    }
}

// View blog post (placeholder - you can create a detail page)
function viewBlogPost(blogId) {
    alert(`Blog post ${blogId} - Full article view coming soon!`);
    // You can create a blog-detail.html page similar to pet-detail.html
}
