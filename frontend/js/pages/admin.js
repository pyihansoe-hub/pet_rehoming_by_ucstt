// js/pages/admin.js - Admin Dashboard Logic

async function renderAdmin() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'admin') {
        window.location.hash = '/';
        return;
    }

    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <h1>Admin Dashboard</h1>
            
            <!-- Tabs -->
            <div class="flex gap-md mb-lg" style="border-bottom: 1px solid var(--border-color); overflow-x: auto;">
                <button onclick="switchAdminTab('stats')" id="tab-stats" class="btn btn-primary">Stats</button>
                <button onclick="switchAdminTab('users')" id="tab-users" class="btn btn-outline">Users</button>
                <button onclick="switchAdminTab('pets')" id="tab-pets" class="btn btn-outline">Pets</button>
                <button onclick="switchAdminTab('blogs')" id="tab-blogs" class="btn btn-outline">Blogs</button>
                <button onclick="switchAdminTab('adoptions')" id="tab-adoptions" class="btn btn-outline">Adoptions</button>
                <button onclick="switchAdminTab('reports')" id="tab-reports" class="btn btn-outline">Reports</button>
                <button onclick="switchAdminTab('monitoring')" id="tab-monitoring" class="btn btn-outline">Monitoring</button>
                <button onclick="switchAdminTab('audit')" id="tab-audit" class="btn btn-outline">Audit Log</button>
            </div>

            <!-- Content Area -->
            <div id="admin-content">
                <div class="flex-center" style="min-height: 300px;">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    // Load stats by default
    switchAdminTab('stats');
}

async function switchAdminTab(tab) {
    const contentDiv = document.getElementById('admin-content');
    
    // Update button styles
    document.querySelectorAll('[id^="tab-"]').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    document.getElementById(`tab-${tab}`).classList.add('btn-primary');
    document.getElementById(`tab-${tab}`).classList.remove('btn-outline');
    contentDiv.innerHTML = '<div class="flex-center" style="min-height: 200px;"><div class="spinner"></div></div>';

    try {
        switch (tab) {
            case 'stats': await renderAdminStats(contentDiv); break;
            case 'users': await renderAdminUsers(contentDiv); break;
            case 'pets': await renderAdminPets(contentDiv); break;
            case 'blogs': await renderAdminBlogs(contentDiv); break;
            case 'adoptions': await renderAdminAdoptions(contentDiv); break;
            case 'reports': await renderAdminReports(contentDiv); break;
            case 'monitoring': await renderAdminMonitoring(contentDiv); break;
            case 'audit': await renderAdminAudit(contentDiv); break;
        }
    } catch (error) {
        contentDiv.innerHTML = `<p class="text-muted">Failed to load ${tab} data.</p>`;
    }
}

// --- Stats Tab ---
async function renderAdminStats(container) {
    const stats = await API.getAdminStats();
    
    container.innerHTML = `
        <div class="grid grid-4 gap-md">
            <div class="card text-center">
                <h3>${stats.total_users}</h3>
                <p>Total Users</p>
            </div>
            <div class="card text-center">
                <h3>${stats.suspended_users}</h3>
                <p>Suspended Users</p>
            </div>
            <div class="card text-center">
                <h3>${stats.total_pets}</h3>
                <p>Total Pets</p>
            </div>
            <div class="card text-center">
                <h3>${stats.completed_payments_total} MMK</h3>
                <p>Total Revenue</p>
            </div>
        </div>
        
        <div class="grid grid-2 gap-md mt-lg">
            <div class="card">
                <h4>Pets by Status</h4>
                <ul>
                    ${Object.entries(stats.pets_by_status || {}).map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('')}
                </ul>
            </div>
            <div class="card">                <h4>Adoptions by Status</h4>
                <ul>
                    ${Object.entries(stats.adoptions_by_status || {}).map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}

// --- Users Tab ---
async function renderAdminUsers(container) {
    const data = await API.getAdminUsers({ page: 1, limit: 20 });
    
    let html = `
        <div class="card">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                        <th class="p-sm">Name</th>
                        <th class="p-sm">Email</th>
                        <th class="p-sm">Role</th>
                        <th class="p-sm">Status</th>
                        <th class="p-sm">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.data.forEach(user => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="p-sm">${user.name}</td>
                <td class="p-sm">${user.email}</td>
                <td class="p-sm">
                    <select onchange="changeUserRole(${user.id}, this.value)" class="form-select form-select-sm">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="p-sm">
                    <span class="status-pill ${user.is_suspended ? 'status-rejected' : 'status-available'}">
                        ${user.is_suspended ? 'Suspended' : 'Active'}
                    </span>
                </td>
                <td class="p-sm">
                    ${user.is_suspended 
                        ? `<button onclick="unsuspendUser(${user.id})" class="btn btn-sm btn-primary">Unsuspend</button>`
                        : `<button onclick="suspendUser(${user.id})" class="btn btn-sm btn-danger">Suspend</button>`
                    }
                    <button onclick="deleteUser(${user.id})" class="btn btn-sm btn-outline ml-sm">Delete</button>                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

async function suspendUser(id) {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    try {
        await API.suspendUser(id, reason);
        switchAdminTab('users');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

async function unsuspendUser(id) {
    try {
        await API.unsuspendUser(id);
        switchAdminTab('users');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

async function changeUserRole(id, role) {
    try {
        await API.changeUserRole(id, role);
        window.utils.showToast('Role updated', 'success');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

async function deleteUser(id) {
    if (!confirm('Permanently delete this user?')) return;
    try {
        await API.deleteUser(id);
        switchAdminTab('users');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

// --- Pets Tab ---
async function renderAdminPets(container) {
    const data = await API.getAdminPets({ page: 1, limit: 20 });
    
    let html = `<div class="card"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid var(--border-color); text-align: left;"><th class="p-sm">Name</th><th class="p-sm">Owner</th><th class="p-sm">Status</th><th class="p-sm">Actions</th></tr></thead><tbody>`;

    data.data.forEach(pet => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="p-sm">${pet.name}</td>                <td class="p-sm">${pet.owner_name}</td>
                <td class="p-sm">
                    <select onchange="updatePetStatus(${pet.id}, this.value)" class="form-select form-select-sm">
                        <option value="available" ${pet.status === 'available' ? 'selected' : ''}>Available</option>
                        <option value="pending" ${pet.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="adopted" ${pet.status === 'adopted' ? 'selected' : ''}>Adopted</option>
                        <option value="withdrawn" ${pet.status === 'withdrawn' ? 'selected' : ''}>Withdrawn</option>
                    </select>
                </td>
                <td class="p-sm">
                    <button onclick="deleteAdminPet(${pet.id})" class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

async function updatePetStatus(id, status) {
    try {
        await API.updatePetStatus(id, status);
        window.utils.showToast('Status updated', 'success');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

async function deleteAdminPet(id) {
    if (!confirm('Delete this pet?')) return;
    try {
        await API.deleteAdminPet(id);
        switchAdminTab('pets');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

// --- Blogs Tab ---
async function renderAdminBlogs(container) {
    const data = await API.getAdminBlogs({ page: 1, limit: 20 });
    
    let html = `<div class="card"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid var(--border-color); text-align: left;"><th class="p-sm">Title</th><th class="p-sm">Author</th><th class="p-sm">Status</th><th class="p-sm">Actions</th></tr></thead><tbody>`;

    data.data.forEach(blog => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="p-sm">${blog.title}</td>
                <td class="p-sm">${blog.author?.name}</td>
                <td class="p-sm">
                    <select onchange="updateBlogStatus(${blog.id}, this.value)" class="form-select form-select-sm">
                        <option value="draft" ${blog.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="published" ${blog.status === 'published' ? 'selected' : ''}>Published</option>                    </select>
                </td>
                <td class="p-sm">
                    <button onclick="deleteAdminBlog(${blog.id})" class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

async function updateBlogStatus(id, status) {
    try {
        await API.updateBlogStatus(id, status);
        window.utils.showToast('Status updated', 'success');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

async function deleteAdminBlog(id) {
    if (!confirm('Delete this blog?')) return;
    try {
        await API.deleteAdminBlog(id);
        switchAdminTab('blogs');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

// --- Adoptions Tab ---
async function renderAdminAdoptions(container) {
    const data = await API.getAdminAdoptions({ page: 1, limit: 20 });
    
    let html = `<div class="card"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid var(--border-color); text-align: left;"><th class="p-sm">Pet</th><th class="p-sm">Requester</th><th class="p-sm">Status</th><th class="p-sm">Actions</th></tr></thead><tbody>`;

    data.data.forEach(req => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="p-sm">${req.pet_name}</td>
                <td class="p-sm">${req.requester_name}</td>
                <td class="p-sm"><span class="status-pill status-${req.status}">${req.status}</span></td>
                <td class="p-sm">
                    ${req.status !== 'cancelled' && req.status !== 'rejected' ? 
                        `<button onclick="closeAdoption(${req.id})" class="btn btn-sm btn-danger">Force Close</button>` : ''}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;}

async function closeAdoption(id) {
    const reason = prompt('Reason for closing:');
    if (!reason) return;
    try {
        await API.closeAdoption(id, reason);
        switchAdminTab('adoptions');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

// --- Reports Tab ---
async function renderAdminReports(container) {
    const data = await API.getAdminReports({ status: 'pending', page: 1, limit: 20 });
    
    if (data.data.length === 0) {
        container.innerHTML = '<div class="card"><p>No pending reports.</p></div>';
        return;
    }

    let html = `<div class="card"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid var(--border-color); text-align: left;"><th class="p-sm">Type</th><th class="p-sm">Reason</th><th class="p-sm">Reporter</th><th class="p-sm">Actions</th></tr></thead><tbody>`;

    data.data.forEach(report => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="p-sm">${report.target_type}</td>
                <td class="p-sm">${report.reason}</td>
                <td class="p-sm">${report.reporter_name}</td>
                <td class="p-sm">
                    <button onclick="resolveReport(${report.id}, 'remove_pet')" class="btn btn-sm btn-danger">Remove Pet</button>
                    <button onclick="resolveReport(${report.id}, 'remove_blog')" class="btn btn-sm btn-danger">Remove Blog</button>
                    <button onclick="resolveReport(${report.id}, 'suspend_reporter')" class="btn btn-sm btn-outline">Suspend Reporter</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

async function resolveReport(id, action) {
    if (!confirm(`Perform action: ${action}?`)) return;
    try {
        await API.resolveReport(id, { status: 'reviewed', action });
        switchAdminTab('reports');
    } catch (e) { window.utils.showToast(e.message, 'error'); }
}

// --- Monitoring Tab ---//
 async function renderAdminMonitoring(container) {
    const [followups, logs] = await Promise.all([
        API.getAdminFollowups({ page: 1, limit: 10 }),
        API.getAdminHealthLogs({ page: 1, limit: 10 })
    ]);

    container.innerHTML = `
        <div class="grid grid-2 gap-lg">
            <div class="card">
                <h4>Recent Follow-ups</h4>
                ${followups.data.map(f => `
                    <div class="mb-sm pb-sm" style="border-bottom: 1px solid var(--border-color);">
                        <strong>${f.health_status}</strong> - ${f.pet_name}
                        <p class="text-muted text-sm">${f.notes || 'No notes'}</p>
                    </div>
                `).join('')}
            </div>
            <div class="card">
                <h4>Recent Health Logs</h4>
                ${logs.data.map(l => `
                    <div class="mb-sm pb-sm" style="border-bottom: 1px solid var(--border-color);">
                        <strong>${l.type}</strong> - ${l.pet_name}
                        <p class="text-muted text-sm">${l.description || 'No description'}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// --- Audit Log Tab ---
async function renderAdminAudit(container) {
    const data = await API.getAuditLog({ page: 1, limit: 20 });
    
    let html = `<div class="card"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid var(--border-color); text-align: left;"><th class="p-sm">Admin</th><th class="p-sm">Action</th><th class="p-sm">Target</th><th class="p-sm">Time</th></tr></thead><tbody>`;

    data.data.forEach(log => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="p-sm">${log.admin_name}</td>
                <td class="p-sm">${log.action}</td>
                <td class="p-sm">${log.target_type}: ${log.target_id}</td>
                <td class="p-sm text-muted">${window.utils.formatDate(log.created_at)}</td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}