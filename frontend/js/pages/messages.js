// js/pages/messages.js - Messages Page Logic

let activeConversationId = null;
let messagePollInterval = null;

async function renderMessages() {
    const mainContent = document.getElementById('main-content');
    
    mainContent.innerHTML = `
        <div class="container mt-lg">
            <h1>Messages</h1>
            <div class="grid grid-2 gap-lg" style="height: 600px;">
                <!-- Conversations List -->
                <div class="card" style="overflow-y: auto;">
                    <h3>Conversations</h3>
                    <div id="conversations-list">
                        <div class="flex-center"><div class="spinner"></div></div>
                    </div>
                </div>

                <!-- Chat Window -->
                <div class="card flex" style="flex-direction: column;">
                    <div id="chat-header" class="mb-md pb-md" style="border-bottom: 1px solid var(--border-color);">
                        <p class="text-muted">Select a conversation to start chatting</p>
                    </div>
                    
                    <div id="messages-container" style="flex: 1; overflow-y: auto; padding: var(--spacing-md); background-color: var(--bg-secondary); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                        <!-- Messages will appear here -->
                    </div>

                    <form id="message-form" class="flex gap-sm" style="display: none;">
                        <input type="text" id="message-input" class="form-input" placeholder="Type a message..." required>
                        <button type="submit" class="btn btn-primary">Send</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    loadConversations();
}

async function loadConversations() {
    try {
        const conversations = await API.getConversations();
        const list = document.getElementById('conversations-list');
        
        if (conversations.length === 0) {
            list.innerHTML = '<p class="text-muted p-md">No conversations yet.</p>';
            return;        }

        list.innerHTML = conversations.map(conv => `
            <div onclick="openConversation(${conv.id}, '${conv.pet_name}', '${conv.other_party_name}')" 
                 class="card mb-sm p-md" 
                 style="cursor: pointer; border: ${activeConversationId === conv.id ? '2px solid var(--primary)' : '1px solid var(--border-color)'}">
                <div class="flex-between">
                    <strong>${conv.other_party_name}</strong>
                    ${conv.unread_count > 0 ? `<span class="badge">${conv.unread_count}</span>` : ''}
                </div>
                <p class="text-muted text-sm mb-0">Pet: ${conv.pet_name}</p>
                <p class="text-muted text-sm truncate">${conv.last_message || 'No messages yet'}</p>
            </div>
        `).join('');

    } catch (error) {
        document.getElementById('conversations-list').innerHTML = '<p class="text-muted">Failed to load conversations.</p>';
    }
}

async function openConversation(id, petName, otherName) {
    activeConversationId = id;
    loadConversations(); // Refresh list to update active border
    
    document.getElementById('chat-header').innerHTML = `
        <h4>Chat with ${otherName}</h4>
        <p class="text-muted text-sm">Regarding: ${petName}</p>
    `;
    
    document.getElementById('message-form').style.display = 'flex';
    
    // Load messages
    await loadMessages(id);
    
    // Start polling for new messages in this conversation
    if (messagePollInterval) clearInterval(messagePollInterval);
    messagePollInterval = setInterval(() => loadMessages(id), 5000);
}

async function loadMessages(conversationId) {
    try {
        const messages = await API.getMessages(conversationId);
        const container = document.getElementById('messages-container');
        
        container.innerHTML = messages.map(msg => `
            <div class="mb-md" style="text-align: ${msg.is_mine ? 'right' : 'left'};">
                <div class="card p-sm" style="display: inline-block; max-width: 70%; background-color: ${msg.is_mine ? 'var(--primary)' : 'var(--bg-card)'}; color: ${msg.is_mine ? 'white' : 'var(--text-primary)'}">
                    <p style="margin: 0;">${msg.content}</p>
                    <span class="text-sm" style="font-size: 0.7rem; opacity: 0.8;">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>            </div>
        `).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Failed to load messages', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('message-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('message-input');
            const content = input.value;
            
            if (!content.trim() || !activeConversationId) return;
            
            try {
                await API.sendMessage(activeConversationId, { content });
                input.value = '';
                loadMessages(activeConversationId);
            } catch (error) {
                window.utils.showToast('Failed to send message', 'error');
            }
        });
    }
});