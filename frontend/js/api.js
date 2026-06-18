// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// API Helper Functions
const api = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Authentication
    auth: {
        register: (userData) => api.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        }),
        login: (credentials) => api.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        }),
        logout: () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
        forgotPassword: (email) => api.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
        resetPassword: (token, password) => api.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        }),
        refreshToken: () => api.request('/auth/refresh-token', { method: 'POST' }),
    },

    // User
    user: {
        getProfile: () => api.request('/user/profile'),
        updateProfile: (data) => api.request('/user/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
        changePassword: (passwords) => api.request('/user/change-password', {
            method: 'PATCH',
            body: JSON.stringify(passwords),
        }),
    },

    // Pets
    pets: {
        list: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return api.request(`/pets${params ? `?${params}` : ''}`);
        },
        trending: (limit = 10) => api.request(`/pets/trending?limit=${limit}`),
        getById: (id) => api.request(`/pets/${id}`),
        create: (petData) => api.request('/pets', {
            method: 'POST',
            body: JSON.stringify(petData),
        }),
        update: (id, petData) => api.request(`/pets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(petData),
        }),
        delete: (id) => api.request(`/pets/${id}`, { method: 'DELETE' }),
        myPets: () => api.request('/pets/my'),
        getStatusHistory: (id) => api.request(`/pets/status-history/${id}`),
        getTimeline: (id) => api.request(`/pets/${id}/timeline`),
        uploadImage: (id, formData) => {
            const token = localStorage.getItem('token');
            return fetch(`${API_BASE_URL}/pets/${id}/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            }).then(res => res.json());
        },
        deleteImage: (petId, imageId) => api.request(`/pets/${petId}/images/${imageId}`, {
            method: 'DELETE',
        }),
        adopt: (id, message) => api.request(`/pets/${id}/adopt`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        }),
    },

    // Pet Types
    petTypes: {
        list: () => api.request('/pet-types'),
    },

    // Adoption
    adoption: {
        getMine: () => api.request('/adoption-requests/mine'),
        getReceived: () => api.request('/adoption-requests/received'),
        update: (id, status) => api.request(`/adoption-requests/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),
        cancel: (id) => api.request(`/adoption-requests/${id}/cancel`, {
            method: 'PATCH',
        }),
        getContract: (id) => api.request(`/adoption-requests/${id}/contract`),
        agreeContract: (id) => api.request(`/adoption-requests/${id}/agree-contract`, {
            method: 'POST',
        }),
    },

    // Messages
    messages: {
        getConversations: () => api.request('/messages/conversations'),
        getChat: (userId) => api.request(`/messages/${userId}`),
        send: (receiverId, content) => api.request('/messages/send', {
            method: 'POST',
            body: JSON.stringify({ receiver_id: receiverId, content }),
        }),
        markRead: (id) => api.request(`/messages/${id}/read`, {
            method: 'PATCH',
        }),
        unreadCount: () => api.request('/messages/unread/count'),
    },

    // Payments
    payments: {
        initiate: (adoptionRequestId) => api.request('/payments/initiate', {
            method: 'POST',
            body: JSON.stringify({ adoption_request_id: adoptionRequestId }),
        }),
        verify: (id) => api.request(`/payments/${id}/verify`, {
            method: 'POST',
        }),
        list: () => api.request('/payments'),
        getById: (id) => api.request(`/payments/${id}`),
    },

    // Monitoring
    monitoring: {
        submitFollowup: (adoptionRequestId, data) => api.request(`/monitoring/followups/${adoptionRequestId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        getFollowups: (adoptionRequestId) => api.request(`/monitoring/followups/${adoptionRequestId}`),
        addHealthLog: (petId, data) => api.request(`/monitoring/pets/${petId}/health-logs`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        getHealthLogs: (petId) => api.request(`/monitoring/pets/${petId}/health-logs`),
        deleteHealthLog: (petId, logId) => api.request(`/monitoring/pets/${petId}/health-logs/${logId}`, {
            method: 'DELETE',
        }),
    },

    // Favorites
    favorites: {
        list: () => api.request('/favorites'),
        add: (petId) => api.request(`/favorites/${petId}`, { method: 'POST' }),
        remove: (petId) => api.request(`/favorites/${petId}`, { method: 'DELETE' }),
    },

    // Notifications
    notifications: {
        list: () => api.request('/notifications'),
        markAllRead: () => api.request('/notifications/read-all', { method: 'PATCH' }),
        markRead: (id) => api.request(`/notifications/${id}/read`, { method: 'PATCH' }),
        delete: (id) => api.request(`/notifications/${id}`, { method: 'DELETE' }),
    },

    // Blog
    blog: {
        list: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return api.request(`/blogs${params ? `?${params}` : ''}`);
        },
        getById: (id) => api.request(`/blogs/${id}`),
        create: (blogData) => api.request('/blogs', {
            method: 'POST',
            body: JSON.stringify(blogData),
        }),
        update: (id, blogData) => api.request(`/blogs/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(blogData),
        }),
        delete: (id) => api.request(`/blogs/${id}`, { method: 'DELETE' }),
        addComment: (id, content) => api.request(`/blogs/${id}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),
    },

    // Chat (AI)
    chat: {
        sendMessage: (message, sessionId = null) => api.request('/chat/message', {
            method: 'POST',
            body: JSON.stringify({ message, session_id: sessionId }),
        }),
        getSessions: () => api.request('/chat/sessions'),
        getSession: (id) => api.request(`/chat/sessions/${id}`),
        deleteSession: (id) => api.request(`/chat/sessions/${id}`, { method: 'DELETE' }),
    },

    // Reports
    reports: {
        create: (reportData) => api.request('/reports', {
            method: 'POST',
            body: JSON.stringify(reportData),
        }),
    },

    // Admin
    admin: {
        getStats: () => api.request('/admin/stats'),
        getUsers: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return api.request(`/admin/users${params ? `?${params}` : ''}`);
        },
        getUser: (id) => api.request(`/admin/users/${id}`),
        updateUserRole: (id, role) => api.request(`/admin/users/${id}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
        }),
        suspendUser: (id, reason) => api.request(`/admin/users/${id}/suspend`, {
            method: 'PATCH',
            body: JSON.stringify({ reason }),
        }),
        unsuspendUser: (id) => api.request(`/admin/users/${id}/unsuspend`, {
            method: 'PATCH',
        }),
        deleteUser: (id) => api.request(`/admin/users/${id}`, { method: 'DELETE' }),
        getPets: () => api.request('/admin/pets'),
        updatePetStatus: (id, status) => api.request(`/admin/pets/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),
        deletePet: (id) => api.request(`/admin/pets/${id}`, { method: 'DELETE' }),
        getAdoptions: () => api.request('/admin/adoptions'),
        closeAdoption: (id, reason) => api.request(`/admin/adoptions/${id}/close`, {
            method: 'PATCH',
            body: JSON.stringify({ reason }),
        }),
        getFollowups: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return api.request(`/admin/followups${params ? `?${params}` : ''}`);
        },
        getHealthLogs: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return api.request(`/admin/health-logs${params ? `?${params}` : ''}`);
        },
        getReports: () => api.request('/admin/reports'),
        resolveReport: (id, action, note) => api.request(`/admin/reports/${id}/resolve`, {
            method: 'PATCH',
            body: JSON.stringify({ action, note }),
        }),
        getAuditLog: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return api.request(`/admin/audit-log${params ? `?${params}` : ''}`);
        },
    },
};
