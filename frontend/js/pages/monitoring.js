// js/pages/monitoring.js - Monitoring Logic (Follow-ups & Health Logs)

// --- Follow-ups Section ---

async function renderFollowups(adoptionRequestId) {
    const container = document.getElementById('followups-container');
    if (!container) return;

    container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';

    try {
        const followups = await API.getFollowups(adoptionRequestId);
        
        if (followups.length === 0) {
            container.innerHTML = '<p class="text-muted">No follow-up reports submitted yet.</p>';
        } else {
            container.innerHTML = followups.map(f => `
                <div class="card mb-md">
                    <div class="flex-between">
                        <span class="status-pill status-${f.health_status}">${f.health_status}</span>
                        <span class="text-muted text-sm">${window.utils.formatDate(f.created_at)}</span>
                    </div>
                    ${f.weight_kg ? `<p><strong>Weight:</strong> ${f.weight_kg} kg</p>` : ''}
                    <p>${f.notes || 'No notes provided.'}</p>
                    ${f.image_url ? `
                        <img src="${window.utils.getImageUrl(f.image_url)}" alt="Followup" style="max-width: 100%; border-radius: var(--radius-md); margin-top: var(--spacing-sm);">
                    ` : ''}
                    <p class="text-muted text-sm mt-sm">Submitted by: ${f.submitter_name}</p>
                </div>
            `).join('');
        }

        // Add "Submit Follow-up" form if user is allowed (owner or adopter)
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        // In a real app, check if user is owner or adopter of this request
        // For now, we assume if they are viewing this tab, they can submit
        container.innerHTML += `
            <div class="card mt-lg">
                <h4>Submit New Follow-up</h4>
                <form id="followup-form">
                    <div class="form-group">
                        <label class="form-label">Health Status</label>
                        <select id="fu-status" class="form-select" required>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="poor">Poor</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Weight (kg)</label>                        <input type="number" id="fu-weight" class="form-input" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea id="fu-notes" class="form-textarea"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Photo (Optional)</label>
                        <input type="file" id="fu-image" class="form-input" accept="image/*">
                    </div>
                    <button type="submit" class="btn btn-primary">Submit Report</button>
                </form>
            </div>
        `;

        document.getElementById('followup-form').addEventListener('submit', (e) => handleFollowupSubmit(e, adoptionRequestId));

    } catch (error) {
        container.innerHTML = '<p class="text-muted">Failed to load follow-ups.</p>';
    }
}

async function handleFollowupSubmit(e, adoptionRequestId) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('health_status', document.getElementById('fu-status').value);
    
    const weight = document.getElementById('fu-weight').value;
    if (weight) formData.append('weight_kg', parseFloat(weight));
    
    const notes = document.getElementById('fu-notes').value;
    if (notes) formData.append('notes', notes);
    
    const imageFile = document.getElementById('fu-image').files[0];
    if (imageFile) formData.append('image', imageFile);

    window.utils.showLoading();
    try {
        await API.createFollowup(adoptionRequestId, formData);
        window.utils.showToast('Follow-up submitted!', 'success');
        renderFollowups(adoptionRequestId); // Refresh list
        document.getElementById('followup-form').reset();
    } catch (error) {
        window.utils.showToast(error.message || 'Submission failed', 'error');
    } finally {
        window.utils.hideLoading();
    }
}
// --- Health Logs Section ---

async function renderHealthLogs(petId) {
    const container = document.getElementById('health-logs-container');
    if (!container) return;

    container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';

    try {
        const logs = await API.getHealthLogs(petId);
        
        if (logs.length === 0) {
            container.innerHTML = '<p class="text-muted">No health logs recorded yet.</p>';
        } else {
            // Sort by date descending
            logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            container.innerHTML = logs.map(log => {
                let icon = '📝';
                if (log.type === 'vaccination') icon = '💉';
                if (log.type === 'vet_visit') icon = '🏥';
                if (log.type === 'deworming') icon = '💊';
                if (log.type === 'weight') icon = '⚖️';

                return `
                    <div class="card mb-md flex-between">
                        <div>
                            <div class="flex gap-sm mb-sm">
                                <span style="font-size: 1.5rem;">${icon}</span>
                                <h4 style="margin: 0;">${log.type.replace('_', ' ').toUpperCase()}</h4>
                            </div>
                            <p>${log.description || 'No description'}</p>
                            ${log.vet_name ? `<p class="text-muted text-sm">Vet: ${log.vet_name}</p>` : ''}
                            ${log.next_due ? `<p class="text-muted text-sm">Next Due: ${window.utils.formatDate(log.next_due)}</p>` : ''}
                        </div>
                        <button onclick="deleteHealthLog(${petId}, ${log.id})" class="btn btn-sm btn-danger">Delete</button>
                    </div>
                `;
            }).join('');
        }

        // Add "Add Log" form
        container.innerHTML += `
            <div class="card mt-lg">
                <h4>Add Health Log</h4>
                <form id="health-log-form">
                    <div class="grid grid-2 gap-md">
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select id="hl-type" class="form-select" required>                                <option value="vaccination">Vaccination</option>
                                <option value="vet_visit">Vet Visit</option>
                                <option value="deworming">Deworming</option>
                                <option value="weight">Weight Check</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Next Due Date (YYYY-MM-DD)</label>
                            <input type="date" id="hl-next-due" class="form-input">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Vet Name (Optional)</label>
                        <input type="text" id="hl-vet" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description / Weight</label>
                        <textarea id="hl-desc" class="form-textarea" placeholder="e.g., 12.5kg or Rabies shot"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Add Log</button>
                </form>
            </div>
        `;

        document.getElementById('health-log-form').addEventListener('submit', (e) => handleHealthLogSubmit(e, petId));

    } catch (error) {
        container.innerHTML = '<p class="text-muted">Failed to load health logs.</p>';
    }
}

async function handleHealthLogSubmit(e, petId) {
    e.preventDefault();
    
    const data = {
        type: document.getElementById('hl-type').value,
        next_due: document.getElementById('hl-next-due').value || null,
        vet_name: document.getElementById('hl-vet').value || null,
        description: document.getElementById('hl-desc').value
    };

    window.utils.showLoading();
    try {
        await API.createHealthLog(petId, data);
        window.utils.showToast('Health log added!', 'success');
        renderHealthLogs(petId); // Refresh list
        document.getElementById('health-log-form').reset();
    } catch (error) {
        window.utils.showToast(error.message || 'Failed to add log', 'error');    } finally {
        window.utils.hideLoading();
    }
}

async function deleteHealthLog(petId, logId) {
    if (!confirm('Delete this health log?')) return;
    
    try {
        await API.deleteHealthLog(petId, logId);
        window.utils.showToast('Log deleted', 'success');
        renderHealthLogs(petId);
    } catch (error) {
        window.utils.showToast(error.message || 'Delete failed', 'error');
    }
}