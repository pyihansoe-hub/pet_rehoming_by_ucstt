function renderHeader() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('token');
    const isAdmin = user && user.role === 'admin';

    const headerHTML = `
        <nav class="navbar">
            <div class="container flex-between">
                <a href="#/" class="logo">
                    PetRehome
                </a>

                <div class="nav-links">
                    <a href="#/">Home</a>
                    <a href="#/browse">Browse Pets</a>
                    <a href="#/blogs">Blog</a>
                    <a href="#/chat">PawBot</a>

                    ${
                        token
                            ? `
                        <a href="#/my-pets">My Pets</a>
                        <a href="#/adoptions">Adoptions</a>

                        <a href="#/messages" class="relative">
                            Messages
                            <span id="msg-badge" class="badge" style="display:none;">0</span>
                        </a>

                        ${isAdmin ? '<a href="#/admin">Admin</a>' : ''}

                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline dropdown-toggle">
                                ${(user && user.name) || 'Profile'} ▼
                            </button>

                            <div class="dropdown-menu">
                                <a href="#/profile">Profile</a>

                                <a href="#/notifications">
                                    Notifications
                                    <span id="notif-badge" class="badge" style="display:none;">0</span>
                                </a>

                                <a href="#" onclick="handleLogout(); return false;">
                                    Logout
                                </a>
                            </div>
                        </div>
                    `
                            : `
                        <a href="#/login" class="btn btn-sm btn-primary">Login</a>
                        <a href="#/register" class="btn btn-sm btn-outline">Register</a>
                    `
                    }

                    <button
                        onclick="toggleDarkMode()"
                        class="theme-toggle"
                        title="Toggle Dark Mode"
                    >
                        🌓
                    </button>
                </div>
            </div>
        </nav>
    `;

    const header = document.getElementById('header');

    if (header) {
        header.innerHTML = headerHTML;
    }

    if (token) {
        startNotificationPolling();
        startMessagePolling();
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    if (window.utils?.showToast) {
        window.utils.showToast('Logged out successfully', 'info');
    }

    setTimeout(() => {
        window.location.hash = '/';
    }, 1000);
}

let notifInterval;

function startNotificationPolling() {
    if (notifInterval) {
        clearInterval(notifInterval);
    }

    const checkNotifications = async () => {
        try {
            const data = await API.getNotifications();
            const badge = document.getElementById('notif-badge');

            if (!badge) return;

            if (data?.unread > 0) {
                badge.textContent = data.unread;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.error('Notification poll error:', error);
        }
    };

    checkNotifications();
    notifInterval = setInterval(checkNotifications, 30000);
}

let msgInterval;

function startMessagePolling() {
    if (msgInterval) {
        clearInterval(msgInterval);
    }

    const checkMessages = async () => {
        try {
            const data = await API.getUnreadCount();
            const badge = document.getElementById('msg-badge');

            if (!badge) return;

            if (data?.unread > 0) {
                badge.textContent = data.unread;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.error('Message poll error:', error);
        }
    };

    checkMessages();
    msgInterval = setInterval(checkMessages, 15000);
}