// js/pages/my-pets.js - My Pets Page Logic

async function renderMyPets() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <div class="flex-between mb-lg">
                <h1>My Pets</h1>
                <a href="/add-pet" class="btn btn-primary">+ Add New Pet</a>
            </div>
            <div id="my-pets-grid" class="grid grid-3">
                <div class="flex-center" style="grid-column: 1/-1; min-height: 200px;">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    try {
        const pets = await API.getMyPets();
        const grid = document.getElementById('my-pets-grid');
        
        if (pets.length === 0) {
            grid.innerHTML = `
                <div class="flex-center" style="grid-column: 1/-1; flex-direction: column;">
                    <p>You haven't added any pets yet.</p>
                    <a href="/#add-pet" class="btn btn-outline mt-md">Add Your First Pet</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = pets.map(pet => {
            const imageUrl = pet.images && pet.images.length > 0 
                ? window.utils.getImageUrl(pet.images.find(i => i.is_primary)?.url || pet.images[0].url)
                : '/placeholder.png';
                
            return `
                <div class="card">
                    <div style="height: 180px; background-image: url('${imageUrl}'); background-size: cover; background-position: center; border-radius: var(--radius-md);"></div>
                    <div class="mt-md">
                        <div class="flex-between">
                            <h4>${pet.name}</h4>
                            <span class="status-pill status-${pet.status}">${pet.status}</span>
                        </div>
                        <p class="text-muted">${pet.breed || 'Unknown'}</p>
                        <div class="flex gap-sm mt-md">
                            <a href="/#ets/${pet.id}" class="btn btn-sm btn-outline" style="flex: 1;">View</a>
                            <a href="/#edit-pet/${pet.id}" class="btn btn-sm btn-primary" style="flex: 1;">Edit</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        document.getElementById('my-pets-grid').innerHTML = '<p>Failed to load your pets.</p>';
    }
}