// Admin Panel JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is admin
    if (!checkAuth() || !isAdmin()) {
        alert('Access denied. Admin privileges required.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    await loadAdminStats();
    setupAdminTabs();
});

// Load admin statistics
async function loadAdminStats() {
    const container = document.getElementById('adminStats');
    try {
        const stats = await api.admin.getStats();
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.total_users || 0}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.total_pets || 0}</div>
                <div class="stat-label">Total Pets</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.total_adoptions || 0}</div>
                <div class="stat-label">Total Adoptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.total_reports || 0}</div>
                <div class="stat-label">Pending Reports</div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load stats: ${error.message}</div>`;
    }
}

// Setup admin tabs
function setupAdminTabs() {
    const tabs = document.querySelectorAll('.sidebar-menu a[data-tab]');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            contents.forEach(c => c.classList.add('hidden'));
            
            const tabName = tab.dataset.tab;
            document.getElementById(`${tabName}-tab`).classList.remove('hidden');
            
            // Load tab data
            switch(tabName) {
                case 'users': loadUsers(); break;
                case 'pets': loadAdminPets(); break;
                case 'adoptions': loadAdminAdoptions(); break;
                case 'reports': loadReports(); break;
                case 'audit': loadAuditLog(); break;
            }
        });
    });
}

// Load users
async function loadUsers() {
    const container = document.getElementById('usersTable');
    const search = document.getElementById('userSearch')?.value || '';
    const role = document.getElementById('userRole')?.value || '';
    
    try {
        const filters = {};
        if (search) filters.search = search;
        if (role) filters.role = role;
        
        const response = await api.admin.getUsers(filters);
        
        if (!response.users || response.users.length === 0) {
            container.innerHTML = '<p>No users found.</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${response.users.map(user => `
                        <tr>
                            <td>${user.name}</td>
                            <td>${user.email}</td>
                            <td>
                                <select onchange="updateUserRole(${user.id}, this.value)" ${user.role === 'admin' && getCurrentUser().id === user.id ? 'disabled' : ''}>
                                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </td>
                            <td>
                                ${user.is_suspended 
                                    ? '<span style="color: #f44336;">Suspended</span>' 
                                    : '<span style="color: #4CAF50;">Active</span>'}
                            </td>
                            <td>
                                ${!user.is_suspended ? 
                                    `<button class="btn btn-sm btn-danger" onclick="suspendUser(${user.id})">Suspend</button>` : 
                                    `<button class="btn btn-sm btn-secondary" onclick="unsuspendUser(${user.id})">Unsuspend</button>`}
                                ${user.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load users: ${error.message}</div>`;
    }
}

// Update user role
async function updateUserRole(userId, role) {
    if (confirm(`Change user role to ${role}?`)) {
        try {
            await api.admin.updateUserRole(userId, role);
            alert('Role updated successfully!');
            loadUsers();
        } catch (error) {
            alert(`Failed to update role: ${error.message}`);
        }
    }
}

// Suspend user
async function suspendUser(userId) {
    const reason = prompt('Enter suspension reason:');
    if (reason) {
        try {
            await api.admin.suspendUser(userId, reason);
            alert('User suspended successfully!');
            loadUsers();
        } catch (error) {
            alert(`Failed to suspend user: ${error.message}`);
        }
    }
}

// Unsuspend user
async function unsuspendUser(userId) {
    try {
        await api.admin.unsuspendUser(userId);
        alert('User unsuspended successfully!');
        loadUsers();
    } catch (error) {
        alert(`Failed to unsuspend user: ${error.message}`);
    }
}

// Delete user
async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await api.admin.deleteUser(userId);
            alert('User deleted successfully!');
            loadUsers();
        } catch (error) {
            alert(`Failed to delete user: ${error.message}`);
        }
    }
}

// Load admin pets
async function loadAdminPets() {
    const container = document.getElementById('adminPetsTable');
    try {
        const response = await api.admin.getPets();
        
        if (!response.pets || response.pets.length === 0) {
            container.innerHTML = '<p>No pets found.</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr><th>Pet</th><th>Owner</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${response.pets.map(pet => `
                        <tr>
                            <td>${pet.name} (${pet.pet_type_name})</td>
                            <td>${pet.owner_name}</td>
                            <td>
                                <select onchange="updatePetStatus(${pet.id}, this.value)">
                                    <option value="available" ${pet.status === 'available' ? 'selected' : ''}>Available</option>
                                    <option value="pending" ${pet.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="adopted" ${pet.status === 'adopted' ? 'selected' : ''}>Adopted</option>
                                    <option value="withdrawn" ${pet.status === 'withdrawn' ? 'selected' : ''}>Withdrawn</option>
                                </select>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="deletePet(${pet.id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load pets: ${error.message}</div>`;
    }
}

// Update pet status
async function updatePetStatus(petId, status) {
    try {
        await api.admin.updatePetStatus(petId, status);
        alert('Status updated successfully!');
    } catch (error) {
        alert(`Failed to update status: ${error.message}`);
    }
}

// Delete pet
async function deletePet(petId) {
    if (confirm('Are you sure you want to delete this pet listing?')) {
        try {
            await api.admin.deletePet(petId);
            alert('Pet deleted successfully!');
            loadAdminPets();
        } catch (error) {
            alert(`Failed to delete pet: ${error.message}`);
        }
    }
}

// Load adoptions
async function loadAdminAdoptions() {
    const container = document.getElementById('adminAdoptionsTable');
    try {
        const response = await api.admin.getAdoptions();
        
        if (!response.adoptions || response.adoptions.length === 0) {
            container.innerHTML = '<p No adoption requests found.</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr><th>Pet</th><th>Requester</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                    ${response.adoptions.map(req => `
                        <tr>
                            <td>${req.pet_name}</td>
                            <td>${req.requester_name}</td>
                            <td><span class="status-badge status-${req.status}">${req.status}</span></td>
                            <td>${formatDate(req.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load adoptions: ${error.message}</div>`;
    }
}

// Load reports
async function loadReports() {
    const container = document.getElementById('reportsTable');
    try {
        const response = await api.admin.getReports();
        
        if (!response.reports || response.reports.length === 0) {
            container.innerHTML = '<p>No reports found.</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr><th>Type</th><th>Reason</th><th>Reporter</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${response.reports.map(report => `
                        <tr>
                            <td>${report.target_type}</td>
                            <td>${report.reason}</td>
                            <td>${report.reporter_name}</td>
                            <td>${report.status}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="resolveReport(${report.id}, 'reviewed')">Mark Reviewed</button>
                                <button class="btn btn-sm btn-secondary" onclick="resolveReport(${report.id}, 'dismissed')">Dismiss</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load reports: ${error.message}</div>`;
    }
}

// Resolve report
async function resolveReport(reportId, action) {
    const note = prompt('Add a note (optional):') || '';
    try {
        await api.admin.resolveReport(reportId, action, note);
        alert(`Report marked as ${action}`);
        loadReports();
    } catch (error) {
        alert(`Failed to resolve report: ${error.message}`);
    }
}

// Load audit log
async function loadAuditLog() {
    const container = document.getElementById('auditTable');
    try {
        const response = await api.admin.getAuditLog();
        
        if (!response.logs || response.logs.length === 0) {
            container.innerHTML = '<p>No audit logs found.</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr><th>Admin</th><th>Action</th><th>Target</th><th>Details</th><th>Date</th></tr>
                </thead>
                <tbody>
                    ${response.logs.map(log => `
                        <tr>
                            <td>${log.admin_name}</td>
                            <td>${log.action}</td>
                            <td>${log.target_type} #${log.target_id || '-'}</td>
                            <td>${log.detail || '-'}</td>
                            <td>${formatDate(log.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load audit log: ${error.message}</div>`;
    }
}
