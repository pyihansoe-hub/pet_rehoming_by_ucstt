// js/pages/home.js - Home Page Logic

async function renderHome() {
    const mainContent = document.getElementById('main-content');
    
    // Show loading state initially
    mainContent.innerHTML = `
        <div class="container flex-center" style="min-height: 50vh;">
            <div class="spinner"></div>
        </div>
    `;

    try {
        // Fetch data in parallel
        const [trendingPets, petTypes, blogs] = await Promise.all([
            API.getTrendingPets(8),
            API.getPetTypes(),
            API.getBlogs({ status: 'published', limit: 3 })
        ]);

        const heroHTML = `
            <section class="hero">
                <div class="container flex-center" style="flex-direction: column; text-align: center; padding: var(--spacing-xxl) 0;">
                    <h1>Find Your New Best Friend 🐾</h1>
                    <p class="mb-lg">Connect with pets looking for a loving home in Yangon.</p>
                    <div class="flex gap-md">
                    #browse" class="btn btn-primary btn-lg">Browse Pets</a>
                        <a href="/#register" class="btn btn-outline btn-lg">Register as Owner</a>
                    </div>
                </div>
            </section>
        `;

        const statsHTML = `
            <section class="stats-section">
                <div class="container grid grid-4">
                    <div class="card flex-center" style="flex-direction: column;">
                        <h3>500+</h3>
                        <p>Pets Rehomed</p>
                    </div>
                    <div class="card flex-center" style="flex-direction: column;">
                        <h3>120+</h3>
                        <p>Active Owners</p>
                    </div>
                    <div class="card flex-center" style="flex-direction: column;">
                        <h3>50+</h3>
                        <p>Breeds Available</p>
                    </div>
                    <div class="card flex-center" style="flex-direction: column;">
                        <h3>24/7</h3>                        <p>Support</p>
                    </div>
                </div>
            </section>
        `;

        const petTypesHTML = `
            <section class="container mt-lg">
                <h2>Browse by Type</h2>
                <div class="flex flex-wrap gap-md">
                    ${petTypes.map(type => `
                        <a href="#/browse?type=${type.id}" class="chip">
                            ${type.name}
                        </a>
                    `).join('')}
                </div>
            </section>
        `;

        const trendingHTML = `
            <section class="container mt-lg">
                <div class="flex-between mb-md">
                    <h2>Trending Pets</h2>
                    <a href="#/browse">View All →</a>
                </div>
                <div class="grid grid-4">
                    ${trendingPets.pets.map(pet => renderPetCard(pet)).join('')}
                </div>
            </section>
        `;

        const blogsHTML = `
            <section class="container mt-lg">
                <div class="flex-between mb-md">
                    <h2>Latest from Blog</h2>
                    <a href="#/blogs">Read More →</a>
                </div>
                <div class="grid grid-3">
                    ${blogs.data.map(blog => renderBlogCard(blog)).join('')}
                </div>
            </section>
        `;

        mainContent.innerHTML = heroHTML + statsHTML + petTypesHTML + trendingHTML + blogsHTML;

    } catch (error) {
        console.error('Home page error:', error);
        mainContent.innerHTML = `
            <div class="container">
                <h2>Welcome to PetRehome</h2>                <p>We are currently experiencing some technical difficulties. Please try again later.</p>
            </div>
        `;
    }
}

// Helper to render a single pet card
function renderPetCard(pet) {
    const imageUrl = pet.images && pet.images.length > 0 
        ? window.utils.getImageUrl(pet.images.find(i => i.is_primary)?.url || pet.images[0].url)
        : '/placeholder.png';
        
    return `
        <div class="card pet-card">
            <div class="pet-image" style="background-image: url('${imageUrl}'); height: 200px; background-size: cover; background-position: center; border-radius: var(--radius-md);"></div>
            <div class="mt-md">
                <div class="flex-between">
                    <h4>${pet.name}</h4>
                    <span class="status-pill status-${pet.status}">${pet.status}</span>
                </div>
                <p class="text-muted">${pet.breed || 'Unknown Breed'}</p>
                <div class="flex-between mt-sm">
                    <span>${pet.location || 'Yangon'}</span>
                    <span class="status-pill status-${pet.fee_type}">${pet.fee_type === 'free' ? 'Free' : pet.adoption_fee + ' MMK'}</span>
                </div>
                <a href="#/pets/${pet.id}" class="btn btn-outline btn-sm mt-md" style="width: 100%;">View Details</a>
            </div>
        </div>
    `;
}

// Helper to render a blog card
function renderBlogCard(blog) {
    const imageUrl = blog.cover_image 
        ? window.utils.getImageUrl(blog.cover_image)
        : '/placeholder.png';

    return `
        <div class="card blog-card">
            <div class="blog-image" style="background-image: url('${imageUrl}'); height: 150px; background-size: cover; background-position: center; border-radius: var(--radius-md);"></div>
            <div class="mt-md">
                <span class="status-pill status-published mb-sm">${blog.category?.name || 'General'}</span>
                <h4><a href="/#blogs/${blog.slug}">${window.utils.truncateText(blog.title, 50)}</a></h4>
                <p class="text-muted text-sm">${window.utils.truncateText(blog.summary, 80)}</p>
                <div class="flex-between mt-sm text-muted text-sm">
                    <span>By ${blog.author?.name || 'Admin'}</span>
                    <span>${window.utils.formatDate(blog.published_at)}</span>
                </div>
            </div>
        </div>    `;
}