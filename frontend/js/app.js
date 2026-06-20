// js/app.js - Main Application Initialization

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Theme
    window.utils.loadTheme();
    
    // 2. Render Global Components
    window.renderHeader();
    window.renderFooter();
    
    // 3. Initialize Router
    window.router();
    
    // 4. Global Error Handling
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global Error:', error);
        // Optionally show a toast for critical errors
        // window.utils.showToast('An unexpected error occurred', 'error');
    };
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    window.router();
});