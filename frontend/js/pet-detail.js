// Pet Detail Page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    const petId = new URLSearchParams(window.location.search).get('id');
    
    if (!petId) {
        window.location.href = 'pets.html';
        return;
    }
    
    await loadPetDetail(petId);
    
    // Setup adoption form
    document.getElementById('adoptForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitAdoptionRequest(petId);
    });
});

// Load pet details
async function loadPetDetail(petId) {
    const container = document.getElementById('petDetail');
    
    try {
        const response = await api.pets.getById(petId);
        const pet = response.pet;
        
        const images = pet.images || [];
        const mainImage = images.length > 0 ? images[0].url : 'https://via.placeholder.com/600x400?text=No+Image';
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <!-- Images -->
                <div>
                    <img src="${mainImage}" alt="${pet.name}" style="width: 100%; border-radius: 10px;" id="mainImage">
                    ${images.length > 1 ? `
                        <div style="display: flex; gap: 10px; margin-top: 15px; overflow-x: auto;">
                            ${images.map((img, i) => `
                                <img src="${img.url}" 
                                     alt="Image ${i + 1}" 
                                     style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px; cursor: pointer;"
                                     onclick="document.getElementById('mainImage').src='${img.url}'">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Info -->
                <div>
                    <h1 style="margin-bottom: 10px;">${pet.name}</h1>
                    <p style="color: #666; font-size: 1.1rem; margin-bottom: 20px;">
                        ${pet.pet_type_name} • ${pet.breed || 'Mixed Breed'}
                    </p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div><strong>Age:</strong> ${pet.age_years || 0} years ${pet.age_months || 0} months</div>
                        <div><strong>Gender:</strong> ${pet.gender || 'Unknown'}</div>
                        <div><strong>Color:</strong> ${pet.color || 'Unknown'}</div>
                        <div><strong>Weight:</strong> ${pet.weight_kg || 'N/A'} kg</div>
                        <div><strong>City:</strong> ${pet.city || 'Unknown'}</div>
                        <div><strong>Fee:</strong> ${pet.fee_type === 'free' ? 'Free' : pet.adoption_fee + ' MMK'}</div>
                        <div><strong>Vaccinated:</strong> ${pet.is_vaccinated ? '✓ Yes' : '✗ No'}</div>
                        <div><strong>Neutered:</strong> ${pet.is_neutered ? '✓ Yes' : '✗ No'}</div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h3>About ${pet.name}</h3>
                        <p>${pet.description || 'No description provided.'}</p>
                    </div>
                    
                    ${pet.health_notes ? `
                        <div style="margin-bottom: 20px;">
                            <h3>Health Notes</h3>
                            <p>${pet.health_notes}</p>
                        </div>
                    ` : ''}
                    
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 10px; margin-bottom: 20px;">
                        <h4>Owner Information</h4>
                        <p><strong>Name:</strong> ${pet.owner_name}</p>
                        ${pet.owner_phone ? `<p><strong>Phone:</strong> ${pet.owner_phone}</p>` : ''}
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" onclick="showAdoptModal(${pet.id})" ${pet.status !== 'available' ? 'disabled' : ''}>
                            ${pet.status !== 'available' ? 'Not Available' : 'Request to Adopt'}
                        </button>
                        <button class="btn btn-secondary" onclick="toggleFavorite(${pet.id}, this)">
                            ❤️ Save
                        </button>
                        <a href="tel:${pet.owner_phone}" class="btn btn-secondary" ${!pet.owner_phone ? 'style="display:none;"' : ''}>
                            📞 Call Owner
                        </a>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <span class="status-badge status-${pet.status}">${pet.status.toUpperCase()}</span>
                        <span style="margin-left: 15px; color: #999;">👁️ ${pet.views} views</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load pet details: ${error.message}</div>`;
    }
}

// Show adoption modal
function showAdoptModal(petId) {
    if (!checkAuth()) {
        alert('Please login to request adoption');
        window.location.href = 'login.html';
        return;
    }
    
    document.getElementById('adoptPetId').value = petId;
    document.getElementById('adoptModal').classList.add('active');
}

// Close adoption modal
function closeAdoptModal() {
    document.getElementById('adoptModal').classList.remove('active');
}

// Submit adoption request
async function submitAdoptionRequest(petId) {
    const message = document.getElementById('adoptMessage').value.trim();
    
    try {
        await api.pets.adopt(petId, message);
        closeAdoptModal();
        alert('Adoption request submitted successfully! The owner will review your request.');
        document.getElementById('adoptMessage').value = '';
    } catch (error) {
        alert(`Failed to submit request: ${error.message}`);
    }
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
