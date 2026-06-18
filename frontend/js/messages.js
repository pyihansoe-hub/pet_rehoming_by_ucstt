// Messages Page JavaScript
let currentConversation = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadConversations();
});

// Load all conversations
async function loadConversations() {
    const container = document.getElementById('conversationsList');
    try {
        const response = await api.messages.getConversations();
        
        if (!response.conversations || response.conversations.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center;">No conversations yet. Start chatting after an adoption is approved!</p>';
            return;
        }
        
        container.innerHTML = response.conversations.map(conv => `
            <div class="conversation-item ${conv.has_unread ? 'unread' : ''}" 
                 data-user-id="${conv.other_user_id}" 
                 data-user-name="${conv.other_user_name}"
                 onclick="selectConversation(${conv.other_user_id}, '${conv.other_user_name}')">
                <h4>${conv.other_user_name}</h4>
                <p style="color: #666; font-size: 0.9rem;">${conv.last_message || 'No messages yet'}</p>
                <small style="color: #999;">${formatDate(conv.last_message_at)}</small>
                ${conv.has_unread ? '<span style="color: #4CAF50; font-weight: bold;">● New</span>' : ''}
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load conversations: ${error.message}</div>`;
    }
}

// Select a conversation
async function selectConversation(userId, userName) {
    currentConversation = { userId, userName };
    
    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-user-id="${userId}"]`)?.classList.add('active');
    
    document.getElementById('chatHeader').innerHTML = `<h3>Chat with ${userName}</h3>`;
    document.getElementById('chatInput').style.display = 'flex';
    
    // Load messages
    await loadMessages(userId);
}

// Load messages for a conversation
async function loadMessages(userId) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    try {
        const response = await api.messages.getChat(userId);
        
        if (!response.messages || response.messages.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; margin-top: 50px;">No messages yet. Start the conversation!</p>';
            return;
        }
        
        container.innerHTML = response.messages.map(msg => `
            <div class="message-bubble ${msg.sender_id === getCurrentUser().id ? 'message-sent' : 'message-received'}">
                ${msg.content}
                <div style="font-size: 0.75rem; margin-top: 5px; opacity: 0.8;">
                    ${new Date(msg.created_at).toLocaleString()}
                </div>
            </div>
        `).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Mark messages as read
        const unreadMessages = response.messages.filter(m => !m.is_read && m.sender_id !== getCurrentUser().id);
        for (const msg of unreadMessages) {
            await api.messages.markRead(msg.id);
        }
        
        // Reload conversations to update unread status
        loadConversations();
    } catch (error) {
        container.innerHTML = `<div class="error-message">Failed to load messages: ${error.message}</div>`;
    }
}

// Send a message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentConversation) {
        return;
    }
    
    try {
        await api.messages.send(currentConversation.userId, content);
        input.value = '';
        
        // Reload messages
        await loadMessages(currentConversation.userId);
        await loadConversations();
    } catch (error) {
        alert(`Failed to send message: ${error.message}`);
    }
}

// Handle Enter key
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}
