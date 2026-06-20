// js/pages/chat.js - PawBot Chat Logic

let currentSessionId = null;
let chatHistory = [];

async function renderChat() {
    const mainContent = document.getElementById('main-content');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    mainContent.innerHTML = `
        <div class="container mt-lg">
            <h1>🐾 PawBot Assistant</h1>
            <p class="text-muted mb-lg">Ask me anything about pet care, adoption, or our services!</p>
            
            <div class="grid grid-2 gap-lg" style="height: 600px;">
                <!-- Sidebar: Sessions (Logged in only) -->
                ${user ? `
                    <div class="card" style="overflow-y: auto;">
                        <div class="flex-between mb-md">
                            <h3>Chat History</h3>
                            <button onclick="createNewSession()" class="btn btn-sm btn-primary">+ New</button>
                        </div>
                        <div id="sessions-list">
                            <div class="flex-center"><div class="spinner"></div></div>
                        </div>
                    </div>
                ` : ''}

                <!-- Chat Window -->
                <div class="card flex" style="flex-direction: column; ${!user ? 'grid-column: 1 / -1;' : ''}">
                    <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: var(--spacing-md); background-color: var(--bg-secondary); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                        <div class="flex-center" style="height: 100%; color: var(--text-muted);">
                            Start a conversation with PawBot!
                        </div>
                    </div>

                    <form id="chat-form" class="flex gap-sm">
                        <input type="text" id="chat-input" class="form-input" placeholder="Type your message..." required>
                        <button type="submit" class="btn btn-primary">Send</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    if (user) {
        loadChatSessions();
    } else {
        // One-shot mode for public users
        document.getElementById('chat-form').addEventListener('submit', handleOneShotChat);    }
}

// --- Logged In Session Logic ---

async function loadChatSessions() {
    try {
        const sessions = await API.getChatSessions();
        const list = document.getElementById('sessions-list');
        
        if (sessions.length === 0) {
            list.innerHTML = '<p class="text-muted p-sm">No history yet.</p>';
            return;
        }

        list.innerHTML = sessions.map(s => `
            <div onclick="loadSession(${s.id})" 
                 class="card mb-sm p-sm" 
                 style="cursor: pointer; border: ${currentSessionId === s.id ? '2px solid var(--primary)' : '1px solid var(--border-color)'}">
                <strong>${s.title || 'New Chat'}</strong>
                <p class="text-muted text-sm mb-0">${new Date(s.updated_at).toLocaleDateString()}</p>
            </div>
        `).join('');

    } catch (error) {
        console.error('Failed to load sessions', error);
    }
}

async function createNewSession() {
    try {
        const session = await API.createChatSession();
        currentSessionId = session.id;
        chatHistory = [];
        document.getElementById('chat-messages').innerHTML = '';
        loadChatSessions();
    } catch (error) {
        window.utils.showToast('Failed to create session', 'error');
    }
}

async function loadSession(id) {
    currentSessionId = id;
    loadChatSessions(); // Update active border
    
    try {
        const messages = await API.getChatHistory(id);
        chatHistory = messages;
        renderChatMessages(messages);
    } catch (error) {        window.utils.showToast('Failed to load history', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('chat-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const message = input.value;
            
            if (!message.trim()) return;

            // Add user message to UI immediately
            addMessageToUI('user', message);
            input.value = '';

            // Show typing indicator
            const typingId = addTypingIndicator();

            try {
                let reply;
                if (currentSessionId) {
                    const res = await API.sendChatMessage(currentSessionId, message);
                    reply = res.reply;
                } else {
                    // Fallback for one-shot if not logged in but somehow here
                    const res = await API.chatOneShot(message);
                    reply = res.reply;
                }
                
                removeTypingIndicator(typingId);
                addMessageToUI('bot', reply);
                
                // Save to local history array for immediate render
                chatHistory.push({ role: 'user', content: message });
                chatHistory.push({ role: 'assistant', content: reply });

            } catch (error) {
                removeTypingIndicator(typingId);
                addMessageToUI('bot', 'Sorry, I encountered an error. Please try again.');
            }
        });
    }
});

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';    messages.forEach(msg => {
        // Assuming API returns { role: 'user'/'assistant', content: '...' }
        addMessageToUI(msg.role === 'user' ? 'user' : 'bot', msg.content);
    });
}

function addMessageToUI(sender, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `mb-md`;
    div.style.textAlign = sender === 'user' ? 'right' : 'left';
    
    div.innerHTML = `
        <div class="card p-sm" style="display: inline-block; max-width: 80%; background-color: ${sender === 'user' ? 'var(--primary)' : 'var(--bg-card)'}; color: ${sender === 'user' ? 'white' : 'var(--text-primary)'}">
            <p style="margin: 0;">${text}</p>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'mb-md';
    div.innerHTML = `
        <div class="card p-sm" style="display: inline-block; background-color: var(--bg-card);">
            <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// --- One-Shot Public Chat Logic ---

async function handleOneShotChat(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value;
        addMessageToUI('user', message);
    input.value = '';
    
    const typingId = addTypingIndicator();
    
    try {
        const res = await API.chatOneShot(message);
        removeTypingIndicator(typingId);
        addMessageToUI('bot', res.reply);
    } catch (error) {
        removeTypingIndicator(typingId);
        addMessageToUI('bot', 'I am having trouble connecting right now.');
    }
}