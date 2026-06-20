// js/pages/blog-list.js - Blog List Page Logic

async function renderBlogList() {
    const mainContent = document.getElementById('main-content');
    
    // Get URL params for initial filters
    const urlParams = new URLSearchParams(window.location.search);
    const initialCategory = urlParams.get('category') || '';
    const initialSearch = urlParams.get('search') || '';

    mainContent.innerHTML = `
        <div class="container mt-lg">
            <h1>Pet Care Blog</h1>
            
            <!-- Filters -->
            <div class="card mb-lg">
                <form id="blog-filter-form" class="flex gap-md flex-wrap">
                    <input type="text" id="blog-search" class="form-input" placeholder="Search articles..." style="flex: 2;" value="${initialSearch}">
                    <select id="blog-category" class="form-select" style="flex: 1;">
                        <option value="">All Categories</option>
                    </select>
                    <button type="submit" class="btn btn-primary">Search</button>
                </form>
            </div>

            <!-- Grid -->
            <div id="blog-grid" class="grid grid-3">
                <div class="flex-center" style="grid-column: 1/-1; min-height: 200px;">
                    <div class="spinner"></div>
                </div>
            </div>

            <!-- Pagination -->
            <div id="blog-pagination" class="flex-center mt-lg gap-sm"></div>
        </div>
    `;

    // Load categories
    loadBlogCategories();

    // Set initial values
    document.getElementById('blog-category').value = initialCategory;

    // Event listeners
    document.getElementById('blog-filter-form').addEventListener('submit', handleBlogFilter);
    
    // Initial load
    loadBlogs(1);
}
let blogFilters = { category: '', search: '', page: 1, limit: 12 };

// async function loadBlogCategories() {
//     try {
//         const categories = await API.getBlogCategories();
//         const select = document.getElementById('blog-category');
//         categories.forEach(cat => {
//             const option = document.createElement('option');
//             option.value = cat.slug;
//             option.textContent = cat.name;
//             select.appendChild(option);
//         });
//     } catch (error) {
//         console.error('Failed to load categories', error);
//     }
// }
// In loadBlogCategories function
async function loadBlogCategories() {
  try {
    const response = await API.getBlogCategories();
    // Safety check
    const categories = Array.isArray(response) ? response : [];
    
    const select = document.getElementById('blog-category');
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.slug;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load categories', error);
  }
}
async function loadBlogs(page) {
    blogFilters.page = page;
    blogFilters.category = document.getElementById('blog-category').value;
    blogFilters.search = document.getElementById('blog-search').value;

    const grid = document.getElementById('blog-grid');
    grid.innerHTML = '<div class="flex-center" style="grid-column: 1/-1;"><div class="spinner"></div></div>';

    try {
        const data = await API.getBlogs({ 
            status: 'published', 
            category: blogFilters.category, 
            search: blogFilters.search,
            page: blogFilters.page,
            limit: blogFilters.limit
        });

        if (data.data.length === 0) {
            grid.innerHTML = '<div class="flex-center" style="grid-column: 1/-1;"><p>No articles found.</p></div>';
            document.getElementById('blog-pagination').innerHTML = '';
            return;
        }

        grid.innerHTML = data.data.map(blog => renderBlogCard(blog)).join('');
        renderBlogPagination(data.total, data.page, data.limit);
    } catch (error) {
        grid.innerHTML = '<div class="flex-center" style="grid-column: 1/-1;"><p>Failed to load blogs.</p></div>';
    }
}

function handleBlogFilter(e) {
    e.preventDefault();
    loadBlogs(1);}

function renderBlogPagination(total, currentPage, limit) {
    const totalPages = Math.ceil(total / limit);
    const container = document.getElementById('blog-pagination');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="btn btn-sm btn-outline" ${currentPage === 1 ? 'disabled' : ''} onclick="loadBlogs(${currentPage - 1})">Prev</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline'}" onclick="loadBlogs(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span>...</span>`;
        }
    }
    
    html += `<button class="btn btn-sm btn-outline" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadBlogs(${currentPage + 1})">Next</button>`;
    container.innerHTML = html;
}