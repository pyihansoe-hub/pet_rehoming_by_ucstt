// js/router.js

// 1. Define routes globally at the very top
const routes = {
    '/': 'home',
    '/browse': 'browse',
    '/pets/:id': 'petDetail',
    '/add-pet': 'addPet',
    '/edit-pet/:id': 'editPet',
    '/my-pets': 'myPets',
    '/adoptions': 'adoptions',
    '/payment/:id': 'payment',
    '/blogs': 'blogList',
    '/blogs/:slug': 'blogDetail',
    '/write-blog': 'writeBlog',
    '/edit-blog/:id': 'editBlog',
    '/messages': 'messages',
    '/notifications': 'notifications',
    '/profile': 'profile',
    '/login': 'login',
    '/register': 'register',
    '/forgot-password': 'forgotPassword',
    '/reset-password': 'resetPassword',
    '/chat': 'chat',
    '/admin': 'admin'
};

function router() {
    const hash = window.location.hash.substring(1) || '/';
    console.log("Routing to:", hash); // Debug log
    
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = '<div class="flex-center" style="min-height: 50vh;"><div class="spinner"></div></div>';
    
    let matchedRoute = null;
    let params = {};
    
    // 2. Use the global 'routes' variable here
    if (routes[hash]) {
        matchedRoute = routes[hash];
    } else {
        for (const [route, page] of Object.entries(routes)) {
            const pattern = new RegExp('^' + route.replace(/:\w+/g, '(\\w+)') + '$');
            const match = hash.match(pattern);
            if (match) {
                matchedRoute = page;
                const keys = route.match(/:(\w+)/g);
                if (keys) {                    keys.forEach((key, index) => {
                        params[key.substring(1)] = match[index + 1];
                    });
                }
                break;
            }
        }
    }
    
    if (!matchedRoute) {
        mainContent.innerHTML = '<div class="container"><h1>404 - Page Not Found</h1><a href="#/">Go Home</a></div>';
        return;
    }
    
    // 3. Auth Check
    const token = localStorage.getItem('token');
    const protectedRoutes = ['addPet', 'editPet', 'myPets', 'adoptions', 'payment', 'writeBlog', 'editBlog', 'messages', 'notifications', 'profile', 'chat', 'admin'];
    
    if (protectedRoutes.includes(matchedRoute) && !token) {
        window.utils.showToast('Please login to access this page', 'error');
        setTimeout(() => {
            window.location.hash = '/login';
        }, 1500);
        return;
    }
    
    // 4. Render Page
    switch (matchedRoute) {
        case 'home': if (typeof renderHome === 'function') renderHome(); break;
        case 'browse': if (typeof renderBrowse === 'function') renderBrowse(); break;
        case 'petDetail': if (typeof renderPetDetail === 'function') renderPetDetail(params.id); break;
        case 'addPet': if (typeof renderAddPet === 'function') renderAddPet(); break;
        case 'editPet': if (typeof renderEditPet === 'function') renderEditPet(params.id); break;
        case 'myPets': if (typeof renderMyPets === 'function') renderMyPets(); break;
        case 'adoptions': if (typeof renderAdoptions === 'function') renderAdoptions(); break;
        case 'payment': if (typeof renderPayment === 'function') renderPayment(params.id); break;
        case 'blogList': if (typeof renderBlogList === 'function') renderBlogList(); break;
        case 'blogDetail': if (typeof renderBlogDetail === 'function') renderBlogDetail(params.slug); break;
        case 'writeBlog': if (typeof renderWriteBlog === 'function') renderWriteBlog(); break;
        case 'editBlog': if (typeof renderEditBlog === 'function') renderEditBlog(params.id); break;
        case 'messages': if (typeof renderMessages === 'function') renderMessages(); break;
        case 'notifications': if (typeof renderNotifications === 'function') renderNotifications(); break;
        case 'profile': if (typeof renderProfile === 'function') renderProfile(); break;
        case 'login': if (typeof renderLogin === 'function') renderLogin(); break;
        case 'register': if (typeof renderRegister === 'function') renderRegister(); break;
        case 'forgotPassword': if (typeof renderForgotPassword === 'function') renderForgotPassword(); break;
        case 'resetPassword': if (typeof renderResetPassword === 'function') renderResetPassword(); break;
        case 'chat': if (typeof renderChat === 'function') renderChat(); break;
        case 'admin': if (typeof renderAdmin === 'function') renderAdmin(); break;
        default: mainContent.innerHTML = '<div class="container"><h1>Page under construction</h1></div>';    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Loaded");
    window.renderHeader();
    window.renderFooter();
    window.router();
});

window.addEventListener('hashchange', window.router);