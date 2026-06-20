// js/components/header.js - Header Component

function renderHeader() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('token');
    const isAdmin = user && user.role === 'admin';
    
    // js/components/header.js - Updated Links

const headerHTML = `
    <nav class="navbar">
        <div class="container flex-between">
            <a href="#/" class="logo">
                🐾 PetRehome
            </a>
            
            <div class="nav-links">
                <a href="#/">Home</a>
                <a href="#/browse">Browse Pets</a>
                <a href="#/blogs">Blog</a>
                <a href="#/chat">PawBot</a>
                
                ${token ? `
                    <a href="#/my-pets">My Pets</a>
                    <a href="#/adoptions">Adoptions</a>
                    <a href="#/messages" class="relative">
                        Messages
                        <span id="msg-badge" class="badge" style="display: none;">0</span>
                    </a>
                    ${isAdmin ? '<a href="#/admin">Admin</a>' : ''}
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline dropdown-toggle">
                            ${user.name || 'Profile'} ▼
                        </button>
                        <div class="dropdown-menu">
                            <a href="#/profile">Profile</a>
                            <a href="#/notifications">
                                Notifications
                                <span id="notif-badge" class="badge" style="display: none;">0</span>
                            </a>
                            <a href="#" onclick="handleLogout()">Logout</a>
                        </div>
                    </div>
                ` : `
                    <a href="#/login" class="btn btn-sm btn-primary">Login</a>
                    <a href="#/register" class="btn btn-sm btn-outline">Register</a>
                `}
                
                <button onclick="toggleDarkMode()" class="theme-toggle" title="Toggle Dark Mode">
                    🌓
                </button>
            </div>
        </div>
    </nav>
`;
    
    document.getElementById('header').innerHTML = headerHTML;
    
    // Start polling for notifications if logged in
    if (token) {
        startNotificationPolling();
        startMessagePolling();
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.utils.showToast('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.hash = '/';
    }, 1000);
}

// Poll for notifications
let notifInterval;
function startNotificationPolling() {
    if (notifInterval) clearInterval(notifInterval);
    
    const checkNotifications = async () => {
        try {
            const data = await API.getNotifications();
            const badge = document.getElementById('notif-badge');
            if (badge && data.unread > 0) {
                badge.textContent = data.unread;
                badge.style.display = 'inline-flex';
            } else if (badge) {
                badge.style.display = 'none';
            }
        } catch (e) {
            console.error('Notification poll error:', e);
        }
    };
    
    checkNotifications();
    notifInterval = setInterval(checkNotifications, 30000); // Every 30s
}

// Poll for messages
let msgInterval;
function startMessagePolling() {    if (msgInterval) clearInterval(msgInterval);
    
    const checkMessages = async () => {
        try {
            const data = await API.getUnreadCount();
            const badge = document.getElementById('msg-badge');
            if (badge && data.unread > 0) {
                badge.textContent = data.unread;
                badge.style.display = 'inline-flex';
            } else if (badge) {
                badge.style.display = 'none';
            }
        } catch (e) {
            console.error('Message poll error:', e);
        }
    };
    
    checkMessages();
    msgInterval = setInterval(checkMessages, 15000); // Every 15s
}