// Pets Page JavaScript
let currentPage = 1;
const limit = 12;

document.addEventListener('DOMContentLoaded', async () => {
    await loadPetTypes();
    await loadPets();
    
    // Get filters from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('type')) {
        document.getElementById('typeFilter').value = urlParams.get('type');
    }
    
    // Setup filter button
    document.getElementById('applyFilters').addEventListener('click', () => {
        currentPage = 1;
        loadPets();
    });
});

// Load pet types for filter dropdown
async function loadPetTypes() {
    try {
        const response = await api.petTypes.list();
        const select = document.getElementById('typeFilter');
        if (response.pet_types) {
            select.innerHTML += response.pet_types.map(type => 
                `<option value="${type.id}">${type.name}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Failed to load pet types:', error);
    }
}

// Load pets with filters
async function loadPets() {
    const container = document.getElementById('petsContainer');
    container.innerHTML = '<div class="loading">Loading pets...</div>';
    
    const filters = {
        page: currentPage,
        limit: limit,
        status: document.getElementById('statusFilter').value || 'available',
    };
    
    const type = document.getElementById('typeFilter').value;
    if (type) filters.type = type;
    
    const city = document.getElementById('cityFilter').value;
    if (city) filters.city = city;
    
    const feeType = document.getElementById('feeTypeFilter').value;
    if (feeType) filters.fee_type = feeType;
    
    const gender = document.getElementById('genderFilter').value;
    if (gender) filters.gender = gender;
    
    const search = document.getElementById('searchInput').value;
    if (search) filters.search = search;
    
    try {
        const response = await api.pets.list(filters);
        
        if (response.pets.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No pets found matching your criteria.</p>';
            return;
        }
        
        container.innerHTML = response.pets.map(pet => createPetCard(pet)).join('');
        
        // Update pagination
        updatePagination(response.total, response.page, response.limit);
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load pets: ${error.message}</div>`;
    }
}

// Update pagination controls
function updatePagination(total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    const paginationEl = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let html = '';
    if (page > 1) {
        html += `<button class="btn btn-secondary btn-sm" onclick="changePage(${page - 1})">Previous</button> `;
    }
    
    html += `<span style="margin: 0 15px;">Page ${page} of ${totalPages}</span> `;
    
    if (page < totalPages) {
        html += `<button class="btn btn-secondary btn-sm" onclick="changePage(${page + 1})">Next</button>`;
    }
    
    paginationEl.innerHTML = html;
}

// Change page
function changePage(page) {
    currentPage = page;
    loadPets();
    window.scrollTo(0, 0);
}

// Create pet card (imported from auth.js utilities)
function createPetCard(pet) {
    const imageUrl = pet.images && pet.images.length > 0 
        ? pet.images[0].url 
        : 'https://via.placeholder.com/300x200?text=No+Image';
    
    return `
        <div class="pet-card" data-pet-id="${pet.id}">
            <img src="${imageUrl}" alt="${pet.name}" class="pet-image" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'">
            <div class="pet-info">
                <h3 class="pet-name">${pet.name}</h3>
                <p class="pet-details">
                    ${pet.pet_type_name} • ${pet.breed || 'Mixed'} • ${pet.age_years || 0}y ${pet.age_months || 0}m
                </p>
                <div class="pet-meta">
                    <span class="pet-badge">${pet.city || 'Unknown'}</span>
                    <button class="favorite-btn ${pet.is_favorited ? 'active' : ''}" onclick="toggleFavorite(${pet.id}, this)">
                        ❤️
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Toggle favorite
async function toggleFavorite(petId, btnElement) {
    if (!checkAuth()) {
        alert('Please login to save favorites');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const isFavorited = btnElement.classList.contains('active');
        
        if (isFavorited) {
            await api.favorites.remove(petId);
            btnElement.classList.remove('active');
        } else {
            await api.favorites.add(petId);
            btnElement.classList.add('active');
        }
    } catch (error) {
        alert(error.message);
    }
}
