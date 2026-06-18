// Main App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Load homepage data
    if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
        await loadHomepageData();
    }
});

// Load homepage data
async function loadHomepageData() {
    try {
        // Load trending pets
        showLoading('trendingPets');
        const trending = await api.pets.trending(6);
        const trendingContainer = document.getElementById('trendingPets');
        if (trendingContainer && trending.pets.length > 0) {
            trendingContainer.innerHTML = trending.pets.map(pet => createPetCard(pet)).join('');
        } else if (trendingContainer) {
            trendingContainer.innerHTML = '<p class="text-center">No trending pets at the moment.</p>';
        }

        // Load pet types
        const petTypesResponse = await api.petTypes.list();
        const petTypesContainer = document.getElementById('petTypes');
        if (petTypesContainer && petTypesResponse.pet_types) {
            const icons = {
                'Dog': '🐕', 'Cat': '🐱', 'Rabbit': '🐰', 'Bird': '🐦',
                'Fish': '🐠', 'Reptile': '🦎', 'Hamster': '🐹', 'Guinea Pig': '🐹', 'Other': '🐾'
            };
            petTypesContainer.innerHTML = petTypesResponse.pet_types.map(type => `
                <div class="pet-type-card" onclick="window.location.href='pages/pets.html?type=${type.id}'">
                    <div class="pet-type-icon">${icons[type.name] || '🐾'}</div>
                    <h3>${type.name}</h3>
                </div>
            `).join('');
        }

        // Load recent pets
        showLoading('recentPets');
        const recent = await api.pets.list({ limit: 8 });
        const recentContainer = document.getElementById('recentPets');
        if (recentContainer && recent.pets.length > 0) {
            recentContainer.innerHTML = recent.pets.map(pet => createPetCard(pet)).join('');
        } else if (recentContainer) {
            recentContainer.innerHTML = '<p class="text-center">No pets available at the moment.</p>';
        }
    } catch (error) {
        console.error('Failed to load homepage data:', error);
        showError('trendingPets', 'Failed to load pets. Please try again later.');
    }
}
