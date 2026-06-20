// js/pages/add-edit-pet.js - Add and Edit Pet Forms

async function renderAddPet() {
    renderPetForm();
}

async function renderEditPet(petId) {
    window.utils.showLoading();
    try {
        const pet = await API.getPetById(petId);
        renderPetForm(pet);
    } catch (error) {
        window.utils.hideLoading();
        window.utils.showToast('Failed to load pet details', 'error');
    }
}

async function renderPetForm(pet = null) {
    const isEdit = !!pet;
    const mainContent = document.getElementById('main-content');
    
    // Fetch types and cities for dropdowns
    const [types, cities] = await Promise.all([API.getPetTypes(), API.getCities()]);

    mainContent.innerHTML = `
        <div class="container mt-lg">
            <div class="card" style="max-width: 800px; margin: 0 auto;">
                <h2>${isEdit ? 'Edit Pet' : 'Add New Pet'}</h2>
                <form id="pet-form">
                    <div class="grid grid-2 gap-md">
                        <div class="form-group">
                            <label class="form-label">Pet Type *</label>
                            <select id="pet-type-id" class="form-select" required>
                                <option value="">Select Type</option>
                                ${types.map(t => `<option value="${t.id}" ${pet?.pet_type_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Name *</label>
                            <input type="text" id="name" class="form-input" value="${pet?.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Breed</label>
                            <input type="text" id="breed" class="form-input" value="${pet?.breed || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Birth Date (DD-MM-YYYY)</label>
                            <input type="text" id="birth-date" class="form-input" placeholder="DD-MM-YYYY" value="${pet?.birth_date ? window.utils.formatDate(pet.birth_date) : ''}">
                        </div>
                        <div class="form-group flex-center">                            <label class="form-checkbox">
                                <input type="checkbox" id="is-sure" ${pet?.is_sure ? 'checked' : ''}>
                                Exact birthday known
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gender</label>
                            <select id="gender" class="form-select">
                                <option value="male" ${pet?.gender === 'male' ? 'selected' : ''}>Male</option>
                                <option value="female" ${pet?.gender === 'female' ? 'selected' : ''}>Female</option>
                                <option value="unknown" ${pet?.gender === 'unknown' ? 'selected' : ''}>Unknown</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Color</label>
                            <input type="text" id="color" class="form-input" value="${pet?.color || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Weight (kg)</label>
                            <input type="number" id="weight-kg" class="form-input" step="0.1" value="${pet?.weight_kg || ''}">
                        </div>
                    </div>

                    <div class="form-group mt-md">
                        <label class="form-label">Description</label>
                        <textarea id="description" class="form-textarea">${pet?.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Health Notes</label>
                        <textarea id="health-notes" class="form-textarea">${pet?.health_notes || ''}</textarea>
                    </div>

                    <div class="grid grid-2 gap-md mt-md">
                        <div class="form-group flex-center">
                            <label class="form-checkbox">
                                <input type="checkbox" id="is-vaccinated" ${pet?.is_vaccinated ? 'checked' : ''}>
                                Vaccinated
                            </label>
                        </div>
                        <div class="form-group flex-center">
                            <label class="form-checkbox">
                                <input type="checkbox" id="is-neutered" ${pet?.is_neutered ? 'checked' : ''}>
                                Neutered
                            </label>
                        </div>
                    </div>

                    <div class="form-group mt-md">
                        <label class="form-label">Fee Type</label>
                        <div class="flex gap-md">                            <label class="form-checkbox">
                                <input type="radio" name="fee-type" value="free" ${pet?.fee_type === 'free' || !pet ? 'checked' : ''}> Free
                            </label>
                            <label class="form-checkbox">
                                <input type="radio" name="fee-type" value="paid" ${pet?.fee_type === 'paid' ? 'checked' : ''}> Paid
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group" id="fee-amount-group" style="${pet?.fee_type === 'free' ? 'display:none;' : ''}">
                        <label class="form-label">Adoption Fee (MMK)</label>
                        <input type="number" id="adoption-fee" class="form-input" value="${pet?.adoption_fee || ''}">
                    </div>

                    <div class="grid grid-2 gap-md mt-md">
                        <div class="form-group">
                            <label class="form-label">City</label>
                            <select id="city" class="form-select">
                                <option value="">Select City</option>
                                ${cities.map(c => `<option value="${c}" ${pet?.city === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Specific Location</label>
                            <input type="text" id="location" class="form-input" value="${pet?.location || ''}">
                        </div>
                    </div>

                    <div class="flex gap-md mt-lg">
                        <button type="submit" class="btn btn-primary btn-lg" style="flex: 1;">${isEdit ? 'Update Pet' : 'Create Pet'}</button>
                        ${isEdit ? `<button type="button" onclick="handleDeletePet(${pet.id})" class="btn btn-danger btn-lg">Delete</button>` : ''}
                    </div>
                </form>
            </div>
        </div>
    `;

    // Handle fee type toggle
    document.querySelectorAll('input[name="fee-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('fee-amount-group').style.display = e.target.value === 'paid' ? 'block' : 'none';
        });
    });

    // Handle form submission
    document.getElementById('pet-form').addEventListener('submit', (e) => handlePetSubmit(e, isEdit, pet?.id));
}

async function handlePetSubmit(e, isEdit, petId) {
    e.preventDefault();    
    const data = {
        pet_type_id: document.getElementById('pet-type-id').value,
        name: document.getElementById('name').value,
        breed: document.getElementById('breed').value,
        birth_date: window.utils.formatDateForAPI(document.getElementById('birth-date').value),
        is_sure: document.getElementById('is-sure').checked,
        gender: document.getElementById('gender').value,
        color: document.getElementById('color').value,
        weight_kg: parseFloat(document.getElementById('weight-kg').value) || null,
        description: document.getElementById('description').value,
        health_notes: document.getElementById('health-notes').value,
        is_vaccinated: document.getElementById('is-vaccinated').checked,
        is_neutered: document.getElementById('is-neutered').checked,
        fee_type: document.querySelector('input[name="fee-type"]:checked').value,
        adoption_fee: parseFloat(document.getElementById('adoption-fee').value) || 0,
        city: document.getElementById('city').value,
        location: document.getElementById('location').value
    };

    window.utils.showLoading();
    try {
        if (isEdit) {
            await API.updatePet(petId, data);
            window.utils.showToast('Pet updated successfully!', 'success');
            setTimeout(() => window.location.hash = `/pets/${petId}`, 1000);
        } else {
            const newPet = await API.createPet(data);
            window.utils.showToast('Pet created successfully!', 'success');
            setTimeout(() => window.location.hash = `/pets/${newPet.id}`, 1000);
        }
    } catch (error) {
        window.utils.showToast(error.message || 'Operation failed', 'error');
    } finally {
        window.utils.hideLoading();
    }
}