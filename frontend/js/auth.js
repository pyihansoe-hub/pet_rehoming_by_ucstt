// Authentication State Management
let currentUser = null;

// Initialize Auth on Page Load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    updateNavAuth();
    setupEventListeners();
});

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
        try {
            currentUser = JSON.parse(userStr);
            return true;
        } catch (e) {
            logout();
            return false;
        }
    }
    return false;
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Check if user is admin
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

// Login function
async function login(email, password) {
    try {
        const response = await api.auth.login({ email, password });
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        currentUser = response.user;
        updateNavAuth();
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Register function
async function register(name, email, password) {
    try {
        const response = await api.auth.register({ name, email, password });
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        currentUser = response.user;
        updateNavAuth();
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Logout function
function logout() {
    api.auth.logout();
    currentUser = null;
    updateNavAuth();
    window.location.href = 'index.html';
}

// Update navigation based on auth state
function updateNavAuth() {
    const authOnlyElements = document.querySelectorAll('.auth-only');
    const guestOnlyElements = document.querySelectorAll('.guest-only');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    
    const isLoggedIn = checkAuth();
    const admin = isAdmin();
    
    authOnlyElements.forEach(el => {
        el.style.display = isLoggedIn ? '' : 'none';
    });
    
    guestOnlyElements.forEach(el => {
        el.style.display = isLoggedIn ? 'none' : '';
    });
    
    adminOnlyElements.forEach(el => {
        el.style.display = admin ? '' : 'none';
    });
    
    // Update user avatar
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl && currentUser) {
        const initial = currentUser.name.charAt(0).toUpperCase();
        avatarEl.textContent = initial;
        avatarEl.title = currentUser.name;
    }
    
    // Load notifications if logged in
    if (isLoggedIn) {
        loadNotificationCount();
    }
}

// Setup global event listeners
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // Notifications dropdown
    const notifBtn = document.querySelector('[href="pages/notifications.html"]');
    const notifDropdown = document.getElementById('notifDropdown');
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.preventDefault();
            notifDropdown.classList.toggle('active');
            loadNotifications();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
                notifDropdown.classList.remove('active');
            }
        });
    }
}

// Load notification count
async function loadNotificationCount() {
    try {
        const response = await api.notifications.list();
        const unreadCount = response.notifications.filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? '' : 'none';
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

// Load notifications for dropdown
async function loadNotifications() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    
    try {
        const response = await api.notifications.list();
        const container = dropdown.querySelector('.notifications-list') || dropdown;
        
        if (response.notifications.length === 0) {
            container.innerHTML = '<div class="notification-item">No notifications</div>';
            return;
        }
        
        container.innerHTML = response.notifications.map(notif => `
            <div class="notification-item ${!notif.is_read ? 'unread' : ''}" data-id="${notif.id}">
                <p>${notif.message}</p>
                <span class="notification-time">${new Date(notif.created_at).toLocaleDateString()}</span>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                if (id) {
                    await api.notifications.markRead(id);
                    item.classList.remove('unread');
                    loadNotificationCount();
                }
            });
        });
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

// Format date helper
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Show loading state
function showLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = '<div class="loading">Loading...</div>';
    }
}

// Show error message
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

// Show success message
function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `<div class="success-message">${message}</div>`;
    }
}

// Create pet card HTML
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
        window.location.href = 'pages/login.html';
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

// Export for use in other files
window.auth = {
    checkAuth,
    getCurrentUser,
    isAdmin,
    login,
    register,
    logout,
};
