// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadDashboardData();
    setupTabNavigation();
    setupForms();
});

// Load all dashboard data
async function loadDashboardData() {
    try {
        // Load user profile
        const profile = await api.user.getProfile();
        document.getElementById('profileName').value = profile.user.name;
        document.getElementById('profileEmail').value = profile.user.email;
        document.getElementById('profilePhone').value = profile.user.phone || '';
        document.getElementById('profileAddress').value = profile.user.address || '';
        
        // Load stats
        await loadStats();
        
        // Load recent activity
        await loadRecentActivity();
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const [myPets, sentRequests, receivedRequests, favorites] = await Promise.all([
            api.pets.myPets(),
            api.adoption.getMine(),
            api.adoption.getReceived(),
            api.favorites.list()
        ]);
        
        document.getElementById('myPetsCount').textContent = myPets.pets?.length || 0;
        document.getElementById('requestsSentCount').textContent = sentRequests.requests?.length || 0;
        document.getElementById('requestsReceivedCount').textContent = receivedRequests.requests?.length || 0;
        document.getElementById('favoritesCount').textContent = favorites.favorites?.length || 0;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    try {
        const [adoptions, messages] = await Promise.all([
            api.adoption.getMine(),
            api.messages.getConversations()
        ]);
        
        let activities = [];
        
        if (adoptions.requests) {
            adoptions.requests.slice(0, 5).forEach(req => {
                activities.push({
                    type: 'adoption',
                    message: `Adoption request for ${req.pet_name} - ${req.status}`,
                    date: req.created_at
                });
            });
        }
        
        if (messages.conversations) {
            messages.conversations.slice(0, 3).forEach(conv => {
                activities.push({
                    type: 'message',
                    message: `New message from ${conv.other_user_name}`,
                    date: conv.last_message_at
                });
            });
        }
        
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (activities.length === 0) {
            container.innerHTML = '<p>No recent activity</p>';
        } else {
            container.innerHTML = activities.map(act => `
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <p>${act.message}</p>
                    <small style="color: #999;">${formatDate(act.date)}</small>
                </div>
            `).join('');
        }
    } catch (error) {
        container.innerHTML = '<p>Failed to load recent activity</p>';
    }
}

// Setup tab navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.sidebar-menu a[data-tab]');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Hide all content
            contents.forEach(c => c.classList.add('hidden'));
            
            // Show selected content
            const tabName = tab.dataset.tab;
            document.getElementById(`${tabName}-tab`).classList.remove('hidden');
            
            // Load tab-specific data
            loadTabData(tabName);
        });
    });
}

// Load tab-specific data
async function loadTabData(tabName) {
    switch(tabName) {
        case 'my-pets':
            await loadMyPets();
            break;
        case 'adoptions':
            await loadAdoptions();
            break;
        case 'favorites':
            await loadFavorites();
            break;
    }
}

// Load my pets
async function loadMyPets() {
    const container = document.getElementById('myPetsContainer');
    try {
        const response = await api.pets.myPets();
        
        if (!response.pets || response.pets.length === 0) {
            container.innerHTML = '<p class="text-center">You haven\'t listed any pets yet.</p>';
            return;
        }
        
        container.innerHTML = response.pets.map(pet => `
            <div class="pet-card">
                <img src="${pet.images?.[0]?.url || 'https://via.placeholder.com/300x200'}" alt="${pet.name}" class="pet-image">
                <div class="pet-info">
                    <h3 class="pet-name">${pet.name}</h3>
                    <p class="pet-details">${pet.pet_type_name} • ${pet.breed || 'Mixed'}</p>
                    <p class="pet-details">Status: <span class="status-badge status-${pet.status}">${pet.status}</span></p>
                    <div style="margin-top: 10px;">
                        <button class="btn btn-sm btn-secondary" onclick="editPet(${pet.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deletePet(${pet.id})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load pets: ${error.message}</div>`;
    }
}

// Load adoptions
async function loadAdoptions() {
    try {
        const [sent, received] = await Promise.all([
            api.adoption.getMine(),
            api.adoption.getReceived()
        ]);
        
        // Render sent requests
        const sentContainer = document.getElementById('sentRequests');
        if (sent.requests && sent.requests.length > 0) {
            sentContainer.innerHTML = `
                <table>
                    <thead>
                        <tr><th>Pet</th><th>Status</th><th>Date</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        ${sent.requests.map(req => `
                            <tr>
                                <td>${req.pet_name}</td>
                                <td><span class="status-badge status-${req.status}">${req.status}</span></td>
                                <td>${formatDate(req.created_at)}</td>
                                <td>
                                    ${req.status === 'pending' ? `<button class="btn btn-sm btn-danger" onclick="cancelAdoption(${req.id})">Cancel</button>` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            sentContainer.innerHTML = '<p>No adoption requests sent.</p>';
        }
        
        // Render received requests
        const receivedContainer = document.getElementById('receivedRequests');
        if (received.requests && received.requests.length > 0) {
            receivedContainer.innerHTML = `
                <table>
                    <thead>
                        <tr><th>User</th><th>Pet</th><th>Message</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${received.requests.map(req => `
                            <tr>
                                <td>${req.requester_name}</td>
                                <td>${req.pet_name}</td>
                                <td>${req.message || '-'}</td>
                                <td><span class="status-badge status-${req.status}">${req.status}</span></td>
                                <td>
                                    ${req.status === 'pending' ? `
                                        <button class="btn btn-sm btn-primary" onclick="updateAdoption(${req.id}, 'approved')">Approve</button>
                                        <button class="btn btn-sm btn-danger" onclick="updateAdoption(${req.id}, 'rejected')">Reject</button>
                                    ` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            receivedContainer.innerHTML = '<p>No adoption requests received.</p>';
        }
    } catch (error) {
        console.error('Failed to load adoptions:', error);
    }
}

// Load favorites
async function loadFavorites() {
    const container = document.getElementById('favoritesContainer');
    try {
        const response = await api.favorites.list();
        
        if (!response.favorites || response.favorites.length === 0) {
            container.innerHTML = '<p class="text-center">No favorite pets yet.</p>';
            return;
        }
        
        container.innerHTML = response.favorites.map(fav => createPetCard(fav.pet)).join('');
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load favorites: ${error.message}</div>`;
    }
}

// Setup forms
function setupForms() {
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api.user.updateProfile({
                name: document.getElementById('profileName').value,
                email: document.getElementById('profileEmail').value,
                phone: document.getElementById('profilePhone').value,
                address: document.getElementById('profileAddress').value
            });
            alert('Profile updated successfully!');
        } catch (error) {
            alert(`Failed to update profile: ${error.message}`);
        }
    });
    
    // Password form
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api.user.changePassword({
                current_password: document.getElementById('currentPassword').value,
                new_password: document.getElementById('newPassword').value
            });
            alert('Password changed successfully!');
            e.target.reset();
        } catch (error) {
            alert(`Failed to change password: ${error.message}`);
        }
    });
    
    // Pet form
    document.getElementById('petForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePet();
    });
}

// Pet Modal functions
async function showCreatePetModal() {
    // Load pet types
    const response = await api.petTypes.list();
    const select = document.getElementById('petType');
    select.innerHTML = response.pet_types.map(type => 
        `<option value="${type.id}">${type.name}</option>`
    ).join('');
    
    // Reset form
    document.getElementById('petForm').reset();
    document.getElementById('petId').value = '';
    document.getElementById('petModalTitle').textContent = 'Add New Pet';
    
    // Show modal
    document.getElementById('petModal').classList.add('active');
}

function closePetModal() {
    document.getElementById('petModal').classList.remove('active');
}

async function editPet(petId) {
    try {
        const response = await api.pets.getById(petId);
        const pet = response.pet;
        
        // Load pet types
        const typesResponse = await api.petTypes.list();
        const select = document.getElementById('petType');
        select.innerHTML = typesResponse.pet_types.map(type => 
            `<option value="${type.id}">${type.name}</option>`
        ).join('');
        
        // Fill form
        document.getElementById('petId').value = pet.id;
        document.getElementById('petType').value = pet.pet_type_id;
        document.getElementById('petName').value = pet.name;
        document.getElementById('petBreed').value = pet.breed || '';
        document.getElementById('petAgeYears').value = pet.age_years || 0;
        document.getElementById('petAgeMonths').value = pet.age_months || 0;
        document.getElementById('petGender').value = pet.gender || '';
        document.getElementById('petColor').value = pet.color || '';
        document.getElementById('petWeight').value = pet.weight_kg || '';
        document.getElementById('petDescription').value = pet.description || '';
        document.getElementById('petCity').value = pet.city || 'Yangon';
        document.getElementById('petFeeType').value = pet.fee_type;
        document.getElementById('petFee').value = pet.adoption_fee || 0;
        
        document.getElementById('petModalTitle').textContent = 'Edit Pet';
        document.getElementById('petModal').classList.add('active');
    } catch (error) {
        alert(`Failed to load pet details: ${error.message}`);
    }
}

async function savePet() {
    const petId = document.getElementById('petId').value;
    const petData = {
        pet_type_id: parseInt(document.getElementById('petType').value),
        name: document.getElementById('petName').value,
        breed: document.getElementById('petBreed').value,
        age_years: parseInt(document.getElementById('petAgeYears').value),
        age_months: parseInt(document.getElementById('petAgeMonths').value),
        gender: document.getElementById('petGender').value,
        color: document.getElementById('petColor').value,
        weight_kg: parseFloat(document.getElementById('petWeight').value) || null,
        description: document.getElementById('petDescription').value,
        city: document.getElementById('petCity').value,
        fee_type: document.getElementById('petFeeType').value,
        adoption_fee: parseFloat(document.getElementById('petFee').value) || 0
    };
    
    try {
        if (petId) {
            await api.pets.update(petId, petData);
            alert('Pet updated successfully!');
        } else {
            await api.pets.create(petData);
            alert('Pet created successfully!');
        }
        closePetModal();
        loadMyPets();
    } catch (error) {
        alert(`Failed to save pet: ${error.message}`);
    }
}

async function deletePet(petId) {
    if (confirm('Are you sure you want to delete this pet listing?')) {
        try {
            await api.pets.delete(petId);
            alert('Pet deleted successfully!');
            loadMyPets();
        } catch (error) {
            alert(`Failed to delete pet: ${error.message}`);
        }
    }
}

async function cancelAdoption(requestId) {
    if (confirm('Are you sure you want to cancel this adoption request?')) {
        try {
            await api.adoption.cancel(requestId);
            alert('Request cancelled successfully!');
            loadAdoptions();
        } catch (error) {
            alert(`Failed to cancel request: ${error.message}`);
        }
    }
}

async function updateAdoption(requestId, status) {
    try {
        await api.adoption.update(requestId, status);
        alert(`Request ${status} successfully!`);
        loadAdoptions();
    } catch (error) {
        alert(`Failed to update request: ${error.message}`);
    }
}
