// js/api.js - API Helper Functions

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
        ...options,
        headers: {
            ...options.headers
        }
    };
    
    // Add auth token if available
    if (token && !options.skipAuth) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for multipart/form-data
    if (!(options.body instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(url, config);
        
        // Handle suspended account
        if (response.status === 403) {
            const data = await response.json();
            if (data.message && data.message.includes('suspended')) {
                handleSuspendedAccount(data.reason);
                throw new Error('Account suspended');
            }
        }
        
        // Handle token expired
        if (response.status === 401) {
            handleTokenExpired();
            throw new Error('Token expired');
        }
        
        // Parse response
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
                if (!response.ok) {
            throw new Error(data.message || data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Handle suspended account
function handleSuspendedAccount(reason) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.utils.showToast(`Your account has been suspended. Reason: ${reason}`, 'error');
    setTimeout(() => {
        window.location.hash = '/login.html';
    }, 2000);
}

// Handle token expired
function handleTokenExpired() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.utils.showToast('Session expired. Please login again.', 'info');
    setTimeout(() => {
        window.location.hash = '/login.html';
    }, 2000);
}

function normalizePet(pet) {
    if (!pet) return pet;
    return {
        ...pet,
        pet_type: pet.pet_type || (pet.pet_type_name ? { id: pet.pet_type_id, name: pet.pet_type_name } : undefined),
        images: pet.images || (pet.primary_image ? [{ url: pet.primary_image, is_primary: true }] : [])
    };
}

function normalizeBlog(blog) {
    if (!blog) return blog;
    const tags = Array.isArray(blog.tags)
        ? blog.tags.map(tag => typeof tag === 'string' ? tag : tag.name).filter(Boolean)
        : [];

    return {
        ...blog,
        cover_image: blog.cover_image || blog.cover_image_url,
        category: blog.category || (blog.category_name ? {
            id: blog.category_id,
            name: blog.category_name,
            slug: blog.category_slug
        } : undefined),
        author: blog.author || (blog.author_name ? {
            id: blog.author_id,
            name: blog.author_name,
            avatar_url: blog.author_avatar
        } : undefined),
        tags
    };
}

// API endpoints
const API = {
    // Auth
    register: (data) => apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (data) => apiRequest('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
    verifyResetToken: (token) => apiRequest(`/api/auth/verify-reset-token?token=${token}`),
    resetPassword: (data) => apiRequest('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    
    // User Profile
    getProfile: () => apiRequest('/api/user/profile'),
    updateProfile: (formData) => apiRequest('/api/user/profile', { method: 'POST', body: formData }),
    changePassword: (data) => apiRequest('/api/user/change-password', { method: 'PATCH', body: JSON.stringify(data) }),
    
    // Pets
    getPets: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/pets?${query}`).then(data => ({
            ...data,
            pets: (data.pets || []).map(normalizePet)
        }));
    },
    getTrendingPets: (limit = 8) => apiRequest(`/api/pets/trending?limit=${limit}`).then(data => ({
        ...data,
        pets: (data.pets || []).map(normalizePet)
    })),
    getPetById: (id) => apiRequest(`/api/pets/${id}`).then(data => normalizePet(data.pet || data)),
    createPet: (data) => apiRequest('/api/pets', { method: 'POST', body: JSON.stringify(data) }).then(data => normalizePet(data.pet || data)),
    updatePet: (id, data) => apiRequest(`/api/pets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(data => normalizePet(data.pet || data)),
    deletePet: (id) => apiRequest(`/api/pets/${id}`, { method: 'DELETE' }),
    getMyPets: () => apiRequest('/api/pets/my').then(data => (data.pets || data || []).map(normalizePet)),
    uploadPetImage: (petId, formData) => apiRequest(`/api/pets/${petId}/images`, { method: 'POST', body: formData }),
    deletePetImage: (petId, imageId) => apiRequest(`/api/pets/${petId}/images/${imageId}`, { method: 'DELETE' }),
    getPetStatusHistory: (id) => apiRequest(`/api/pets/${id}/status-history`),
    adoptPet: (id) => apiRequest(`/api/pets/${id}/adopt`, { method: 'POST' }),
    getPetTypes: () => apiRequest('/api/pet-types').then(data => data.petTypes || data),
    getCities: () => apiRequest('/api/pets/cities').then(data => data.cities || data),
    
    // Favorites
    getFavorites: () => apiRequest('/api/favorites'),
    addFavorite: (petId) => apiRequest(`/api/favorites/${petId}`, { method: 'POST' }),
    removeFavorite: (petId) => apiRequest(`/api/favorites/${petId}`, { method: 'DELETE' }),
    
    // Adoption Requests
    getMyAdoptionRequests: () => apiRequest('/api/adoption-requests/mine'),
    getReceivedAdoptionRequests: () => apiRequest('/api/adoption-requests/received'),
    updateAdoptionRequest: (id, data) => apiRequest(`/api/adoption-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    cancelAdoptionRequest: (id) => apiRequest(`/api/adoption-requests/${id}/cancel`, { method: 'PATCH' }),
    getAgreement: (id) => apiRequest(`/api/adoption-requests/${id}/agreement`),
    signAgreement: (id) => apiRequest(`/api/adoption-requests/${id}/agreement/agree`, { method: 'PATCH' }),
    
    // Payments
    initiatePayment: (data) => apiRequest('/api/payments/initiate', { method: 'POST', body: JSON.stringify(data) }),
    verifyPayment: (id) => apiRequest(`/api/payments/${id}/verify`, { method: 'POST' }),
    getPayments: () => apiRequest('/api/payments'),
    getPaymentById: (id) => apiRequest(`/api/payments/${id}`),
    
    // Monitoring - Follow-ups
    getFollowups: (adoptionRequestId) => apiRequest(`/api/monitoring/followups/${adoptionRequestId}`),
    createFollowup: (adoptionRequestId, formData) => apiRequest(`/api/monitoring/followups/${adoptionRequestId}`, { method: 'POST', body: formData }),
    
    // Monitoring - Health Logs
    getHealthLogs: (petId) => apiRequest(`/api/monitoring/pets/${petId}/health-logs`),
    createHealthLog: (petId, data) => apiRequest(`/api/monitoring/pets/${petId}/health-logs`, { method: 'POST', body: JSON.stringify(data) }),
    deleteHealthLog: (petId, logId) => apiRequest(`/api/monitoring/pets/${petId}/health-logs/${logId}`, { method: 'DELETE' }),
    
    // Blogs
    getBlogs: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/blogs?${query}`).then(data => ({
            ...data,
            data: (data.blogs || data.data || []).map(normalizeBlog),
            blogs: (data.blogs || data.data || []).map(normalizeBlog)
        }));
    },
    getBlogBySlug: async (slug) => {
        const data = await apiRequest(`/api/blogs/${slug}`);
        const blog = normalizeBlog(data.blog || data);
        try {
            const commentsData = await apiRequest(`/api/blogs/${blog.id}/comments`);
            blog.comments = commentsData.comments || commentsData || [];
        } catch (_error) {
            blog.comments = [];
        }
        return blog;
    },
    createBlog: (formData) => apiRequest('/api/blogs', { method: 'POST', body: formData }).then(data => normalizeBlog(data.blog || data)),
    updateBlog: (id, formData) => apiRequest(`/api/blogs/${id}`, { method: 'PATCH', body: formData }),
    deleteBlog: (id) => apiRequest(`/api/blogs/${id}`, { method: 'DELETE' }),    likeBlog: (id) => apiRequest(`/api/blogs/${id}/like`, { method: 'POST' }),
    getBlogComments: (id) => apiRequest(`/api/blogs/${id}/comments`),
    addComment: (id, data) => apiRequest(`/api/blogs/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
    deleteComment: (blogId, commentId) => apiRequest(`/api/blogs/${blogId}/comments/${commentId}`, { method: 'DELETE' }),
    getBlogCategories: () => apiRequest('/api/blogs/categories').then(data => data.categories || data),
    
    // Messages
    getConversations: () => apiRequest('/api/messages/conversations'),
    createConversation: (data) => apiRequest('/api/messages/conversations', { method: 'POST', body: JSON.stringify(data) }),
    getMessages: (conversationId) => apiRequest(`/api/messages/conversations/${conversationId}`),
    sendMessage: (conversationId, data) => apiRequest(`/api/messages/conversations/${conversationId}`, { method: 'POST', body: JSON.stringify(data) }),
    getUnreadCount: () => apiRequest('/api/messages/unread-count'),
    
    // Notifications
    getNotifications: () => apiRequest('/api/notifications'),
    markNotificationRead: (id) => apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllNotificationsRead: () => apiRequest('/api/notifications/read-all', { method: 'PATCH' }),
    deleteNotification: (id) => apiRequest(`/api/notifications/${id}`, { method: 'DELETE' }),
    
    // Chat
    chatOneShot: (message) => apiRequest('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }),
    createChatSession: () => apiRequest('/api/chat/sessions', { method: 'POST' }),
    sendChatMessage: (sessionId, message) => apiRequest(`/api/chat/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
    getChatHistory: (sessionId) => apiRequest(`/api/chat/sessions/${sessionId}/messages`),
    getChatSessions: () => apiRequest('/api/chat/sessions'),
    deleteChatSession: (sessionId) => apiRequest(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' }),
    
    // Admin
    getAdminStats: () => apiRequest('/api/admin/stats'),
    getAdminUsers: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/users?${query}`);
    },
    suspendUser: (id, reason) => apiRequest(`/api/admin/users/${id}/suspend`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    unsuspendUser: (id) => apiRequest(`/api/admin/users/${id}/unsuspend`, { method: 'PATCH' }),
    changeUserRole: (id, role) => apiRequest(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    deleteUser: (id) => apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' }),
    getAdminPets: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/pets?${query}`);
    },
    updatePetStatus: (id, status) => apiRequest(`/api/admin/pets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteAdminPet: (id) => apiRequest(`/api/admin/pets/${id}`, { method: 'DELETE' }),
    getAdminBlogs: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/blogs?${query}`);
    },
    updateBlogStatus: (id, status) => apiRequest(`/api/admin/blogs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteAdminBlog: (id) => apiRequest(`/api/admin/blogs/${id}`, { method: 'DELETE' }),
    getAdminAdoptions: (params = {}) => {        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/adoptions?${query}`);
    },
    closeAdoption: (id, reason) => apiRequest(`/api/admin/adoptions/${id}/close`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    getAdminReports: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/reports?${query}`);
    },
    resolveReport: (id, data) => apiRequest(`/api/admin/reports/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
    getAdminFollowups: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/followups?${query}`);
    },
    getAdminHealthLogs: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/health-logs?${query}`);
    },
    getAuditLog: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/api/admin/audit-log?${query}`);
    }
};

window.API = API;
