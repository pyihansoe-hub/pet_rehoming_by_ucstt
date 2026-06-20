// js/pages/notifications.js - Notifications Page Logic

async function renderNotifications() {
    const mainContent = document.getElementById('main-content');
    
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <div class="flex-between mb-lg">
                <h1>Notifications</h1>
                <button onclick="markAllAsRead()" class="btn btn-sm btn-outline">Mark All as Read</button>
            </div>
            
            <div id="notifications-list">
                <div class="flex-center"><div class="spinner"></div></div>
            </div>
        </div>
    `;

    loadNotifications();
}

async function loadNotifications() {
    try {
        const data = await API.getNotifications();
        const list = document.getElementById('notifications-list');
        
        if (data.notifications.length === 0) {
            list.innerHTML = '<p class="text-muted">No notifications.</p>';
            return;
        }

        list.innerHTML = data.notifications.map(notif => `
            <div class="card mb-md ${!notif.read ? 'border-left-primary' : ''}" style="${!notif.read ? 'border-left: 4px solid var(--primary);' : ''}">
                <div class="flex-between">
                    <h4>${getNotificationTitle(notif.type)}</h4>
                    <span class="text-muted text-sm">${window.utils.formatDate(notif.created_at)}</span>
                </div>
                <p>${notif.message}</p>
                <div class="flex gap-sm mt-sm">
                    ${!notif.read ? `<button onclick="markAsRead(${notif.id})" class="btn btn-sm btn-outline">Mark as Read</button>` : ''}
                    <button onclick="deleteNotification(${notif.id})" class="btn btn-sm btn-danger">Delete</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        document.getElementById('notifications-list').innerHTML = '<p class="text-muted">Failed to load notifications.</p>';
    }
}

function getNotificationTitle(type) {
    switch(type) {
        case 'new_adoption_request': return 'New Adoption Request';
        case 'adoption_reviewed': return 'Adoption Update';
        case 'payment_completed': return 'Payment Successful';
        default: return 'Notification';
    }
}

async function markAsRead(id) {
    try {
        await API.markNotificationRead(id);
        loadNotifications();
    } catch (error) {
        window.utils.showToast('Failed to update notification', 'error');
    }
}

async function markAllAsRead() {
    try {
        await API.markAllNotificationsRead();
        loadNotifications();
    } catch (error) {
        window.utils.showToast('Failed to update notifications', 'error');
    }
}

async function deleteNotification(id) {
    try {
        await API.deleteNotification(id);
        loadNotifications();
    } catch (error) {
        window.utils.showToast('Failed to delete notification', 'error');
    }
}