// js/pages/pet-detail.js - Pet Detail Page Logic

async function renderPetDetail(petId) {
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
        const pet = await API.getPetById(petId);
        const isOwner = user && user.id === pet.owner_id;
        
        // Render Gallery
        const primaryImage = pet.images.find(i => i.is_primary) || pet.images[0];
        const otherImages = pet.images.filter(i => i.id !== (primaryImage?.id));
        
        const galleryHTML = `
            <div class="card mb-lg">
                <div id="main-image" style="height: 400px; background-image: url('${window.utils.getImageUrl(primaryImage?.url)}'); background-size: cover; background-position: center; border-radius: var(--radius-md);"></div>
                ${otherImages.length > 0 ? `
                    <div class="flex gap-sm mt-md" style="overflow-x: auto;">
                        ${otherImages.map(img => `
                            <div onclick="changeMainImage('${window.utils.getImageUrl(img.url)}')" 
                                 style="width: 80px; height: 80px; background-image: url('${window.utils.getImageUrl(img.url)}'); background-size: cover; cursor: pointer; border-radius: var(--radius-sm); border: 2px solid transparent;" 
                                 class="thumb-img"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        // Render Info Grid
        const infoHTML = `
            <div class="grid grid-2 gap-lg">
                <div class="card">
                    <h2>${pet.name} <span class="status-pill status-${pet.status}">${pet.status}</span></h2>
                    <p class="text-muted">${pet.breed || 'Unknown Breed'} • ${pet.gender || 'Unknown'}</p>
                    
                    <div class="grid grid-2 mt-lg">
                        <div><strong>Type:</strong> ${pet.pet_type?.name || 'N/A'}</div>
                        <div><strong>Color:</strong> ${pet.color || 'N/A'}</div>
                        <div><strong>Weight:</strong> ${pet.weight_kg ? pet.weight_kg + ' kg' : 'N/A'}</div>
                        <div><strong>Location:</strong> ${pet.city || pet.location || 'Yangon'}</div>
                        <div><strong>Birth Date:</strong> ${window.utils.formatDate(pet.birth_date)}</div>                        <div><strong>Exact Birthday:</strong> ${pet.is_sure ? 'Yes' : 'No'}</div>
                    </div>

                    <div class="mt-lg">
                        <h4>Health Information</h4>
                        <div class="flex gap-md mt-sm">
                            <span class="status-pill ${pet.is_vaccinated ? 'status-good' : 'status-gray'}">Vaccinated</span>
                            <span class="status-pill ${pet.is_neutered ? 'status-good' : 'status-gray'}">Neutered</span>
                        </div>
                        ${pet.health_notes ? `<p class="mt-sm text-muted">${pet.health_notes}</p>` : ''}
                    </div>
                </div>

                <div class="card">
                    <h3>Adoption Details</h3>
                    <div class="flex-between mb-md">
                        <span>Fee Type:</span>
                        <span class="status-pill status-${pet.fee_type}">${pet.fee_type === 'free' ? 'Free Adoption' : pet.adoption_fee + ' MMK'}</span>
                    </div>
                    <p>${pet.description || 'No description provided.'}</p>
                    
                    <div class="mt-lg">
                        <h4>Contact Owner</h4>
                        <p><strong>Name:</strong> ${pet.owner_name}</p>
                        <p><strong>Phone:</strong> ${pet.owner_phone}</p>
                    </div>

                    ${!isOwner ? `
                        <button onclick="handleAdopt(${pet.id})" 
                                class="btn btn-primary btn-lg mt-lg" 
                                style="width: 100%;" 
                                ${pet.status !== 'available' ? 'disabled' : ''}>
                            ${pet.status === 'available' ? 'Request Adoption' : 'Currently Unavailable'}
                        </button>
                    ` : `
                        <div class="flex gap-md mt-lg">
                            <a href="/#edit-pet/${pet.id}" class="btn btn-outline" style="flex: 1;">Edit Pet</a>
                            <button onclick="handleDeletePet(${pet.id})" class="btn btn-danger" style="flex: 1;">Delete</button>
                        </div>
                        
                        <!-- Owner Image Upload Section -->
                        <div class="mt-lg pt-lg" style="border-top: 1px solid var(--border-color);">
                            <h4>Manage Images</h4>
                            <form id="upload-form" class="flex gap-sm mt-sm">
                                <input type="file" id="image-file" class="form-input" accept="image/*" required>
                                <label class="form-checkbox">
                                    <input type="checkbox" id="is-primary"> Primary
                                </label>
                                <button type="submit" class="btn btn-sm btn-primary">Upload</button>
                            </form>                        </div>
                    `}
                </div>
            </div>
            
        `;

        mainContent.innerHTML = galleryHTML + infoHTML;
        
        // Add upload listener if owner
        if (isOwner) {
            document.getElementById('upload-form').addEventListener('submit', (e) => handleImageUpload(e, petId));
            
            const monitoringHTML = `
                <div class="mt-lg pt-lg" style="border-top: 1px solid var(--border-color);">
                    <h3>Health Monitoring</h3>
                    <div id="health-logs-container"></div>
                </div>
                `;
            mainContent.innerHTML += monitoringHTML;
            renderHealthLogs(pet.id); 
        }

    } catch (error) {
        mainContent.innerHTML = `<div class="container"><h2>Pet not found or error loading details.</h2></div>`;
    }
}

function changeMainImage(url) {
    document.getElementById('main-image').style.backgroundImage = `url('${url}')`;
}

async function handleAdopt(petId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.utils.showToast('Please login to adopt a pet', 'error');
        setTimeout(() => window.location.hash = '/login', 1500);
        return;
    }

    window.utils.showLoading();
    try {
        const result = await API.adoptPet(petId);
        window.utils.hideLoading();
        
        if (result.paymentRequired) {
            window.utils.showToast('Proceeding to payment...', 'info');
            setTimeout(() => window.location.hash = `/payment/${result.adoption_request_id}`, 1000);
        } else {
            window.utils.showToast('Adoption request submitted successfully!', 'success');
            setTimeout(() => window.location.hash = '/adoptions', 1500);
        }
    } catch (error) {
        window.utils.hideLoading();
        window.utils.showToast(error.message || 'Failed to submit request', 'error');
    }
}

async function handleImageUpload(e, petId) {
    e.preventDefault();    const fileInput = document.getElementById('image-file');
    const isPrimary = document.getElementById('is-primary').checked;
    
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    formData.append('is_primary', isPrimary);

    window.utils.showLoading();
    try {
        await API.uploadPetImage(petId, formData);
        window.utils.showToast('Image uploaded!', 'success');
        renderPetDetail(petId); // Refresh page
    } catch (error) {
        window.utils.showToast(error.message || 'Upload failed', 'error');
    } finally {
        window.utils.hideLoading();
    }
}

async function handleDeletePet(petId) {
    if (!confirm('Are you sure you want to delete this pet? This cannot be undone.')) return;
    
    window.utils.showLoading();
    try {
        await API.deletePet(petId);
        window.utils.showToast('Pet deleted successfully', 'success');
        setTimeout(() => window.location.hash = '/my-pets', 1000);
    } catch (error) {
        window.utils.hideLoading();
        window.utils.showToast(error.message || 'Delete failed', 'error');
    }
}