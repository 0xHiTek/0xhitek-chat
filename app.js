// ============================================
// app.js - Main Application Logic with Fixes
// ============================================

// Initialize Supabase client
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Global State Management
class AppState {
    constructor() {
        this.user = null;
        this.currentChatId = null;
        this.messages = [];
        this.models = [];
        this.settings = {
            openrouterKey: CONFIG.OPENROUTER_API_KEY,
            maxTokens: 1000,
            temperature: 0.7,
            selectedModel: CONFIG.DEFAULT_MODEL
        };
        this.tokenCount = 0;
        this.isProcessing = false;
        this.keepAliveInterval = null;
        this.retryCount = 0;
        this.lastActivity = Date.now();
    }

    // Keep connection alive to prevent idle timeout
    startKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }
        
        this.keepAliveInterval = setInterval(async () => {
            if (this.user && !this.isProcessing) {
                try {
                    // Simple ping to keep Supabase connection alive
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', this.user.id)
                        .limit(1)
                        .single();
                    
                    this.lastActivity = Date.now();
                    console.log('Keep-alive ping successful');
                } catch (error) {
                    console.log('Keep-alive ping error:', error);
                }
            }
        }, CONFIG.KEEP_ALIVE_INTERVAL);
    }

    stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    updateActivity() {
        this.lastActivity = Date.now();
    }

    isConnectionStale() {
        return (Date.now() - this.lastActivity) > 30000; // 30 seconds
    }
}

const appState = new AppState();

// ============================================
// Authentication Functions
// ============================================

async function handleLogin(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        appState.user = data.user;
        await loadUserProfile();
        await loadChatHistory();
        appState.startKeepAlive();
        
        showToast('Login successful!', 'success');
        closeAuthModal();
        updateUIState();
        
        return true;
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message || 'Login failed', 'error');
        return false;
    }
}

async function handleSignup(email, password, fullName) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        // Create profile immediately after signup
        if (data.user) {
            await supabase.from('profiles').insert({
                id: data.user.id,
                email: email,
                full_name: fullName,
                openrouter_key: CONFIG.OPENROUTER_API_KEY,
                settings: appState.settings,
                created_at: new Date().toISOString()
            });
        }

        showToast('Signup successful! Please check your email for verification.', 'success');
        closeAuthModal();
        
        return true;
    } catch (error) {
        console.error('Signup error:', error);
        showToast(error.message || 'Signup failed', 'error');
        return false;
    }
}

async function handleLogout() {
    try {
        appState.stopKeepAlive();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        appState.user = null;
        appState.currentChatId = null;
        appState.messages = [];
        
        updateUIState();
        clearChatDisplay();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    }
}

// ============================================
// Profile Management
// ============================================

async function loadUserProfile() {
    if (!appState.user) return;

    try {
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', appState.user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Profile doesn't exist, create it
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: appState.user.id,
                    email: appState.user.email,
                    full_name: appState.user.user_metadata?.full_name || '',
                    openrouter_key: CONFIG.OPENROUTER_API_KEY,
                    settings: appState.settings,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (createError) throw createError;
            data = newProfile;
        }

        if (data) {
            // Load settings from profile
            if (data.openrouter_key) {
                appState.settings.openrouterKey = data.openrouter_key;
            }
            if (data.settings) {
                appState.settings = { ...appState.settings, ...data.settings };
            }
            
            // Update UI with profile data
            if (document.getElementById('profileName')) {
                document.getElementById('profileName').value = data.full_name || '';
            }
            if (document.getElementById('openrouterKey')) {
                document.getElementById('openrouterKey').value = data.openrouter_key || '';
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function saveProfile(profileData) {
    if (!appState.user) return;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profileData.fullName,
                openrouter_key: profileData.openrouterKey,
                settings: {
                    maxTokens: profileData.maxTokens,
                    temperature: profileData.temperature,
                    selectedModel: profileData.selectedModel
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', appState.user.id);

        if (error) throw error;

        // Update local state
        appState.settings = {
            ...appState.settings,
            openrouterKey: profileData.openrouterKey,
            maxTokens: profileData.maxTokens,
            temperature: profileData.temperature,
            selectedModel: profileData.selectedModel
        };

        showToast('Profile updated successfully', 'success');
        return true;
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Error saving profile', 'error');
        return false;
    }
}

// ============================================
// Chat Functions with Retry Logic
// ============================================

async function createNewChat() {
    if (!appState.user) {
        showToast('Please login to create a chat', 'warning');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('chats')
            .insert({
                user_id: appState.user.id,
                title: 'New Chat',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        appState.currentChatId = data.id;
        appState.messages = [];
        clearChatDisplay();
        await loadChatHistory();
        
        return data.id;
    } catch (error) {
        console.error('Error creating chat:', error);
        showToast('Error creating new chat', 'error');
        return null;
    }
}

async function loadChat(chatId) {
    if (!appState.user) return;

    try {
        // Load chat messages
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        appState.currentChatId = chatId;
        appState.messages = messages || [];
        displayMessages();
        updateChatHistoryUI();
    } catch (error) {
        console.error('Error loading chat:', error);
        showToast('Error loading chat', 'error');
    }
}

async function loadChatHistory() {
    if (!appState.user) return;

    try {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', appState.user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (data && document.getElementById('chatHistory')) {
            const historyContainer = document.getElementById('chatHistory');
            historyContainer.innerHTML = data.map(chat => `
                <div class="chat-item ${chat.id === appState.currentChatId ? 'active' : ''}" 
                     onclick="loadChat('${chat.id}')"
                     data-chat-id="${chat.id}">
                    <div>${chat.title || 'New Chat'}</div>
                    <small>${new Date(chat.created_at).toLocaleDateString()}</small>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// ============================================
// Message Handling with Retry and Connection Management
// ============================================

async function sendMessage(messageText) {
    if (!messageText || appState.isProcessing) return;
    
    if (!appState.user) {
        showToast('Please login to send messages', 'warning');
        return;
    }

    // Check if connection is stale and refresh if needed
    if (appState.isConnectionStale()) {
        await refreshConnection();
    }

    appState.isProcessing = true;
    appState.updateActivity();
    
    try {
        // Create chat if none exists
        if (!appState.currentChatId) {
            const chatId = await createNewChat();
            if (!chatId) {
                throw new Error('Failed to create chat');
            }
        }

        // Display user message immediately
        displayUserMessage(messageText);
        
        // Save user message to database
        const { data: userMessage, error: msgError } = await supabase
            .from('messages')
            .insert({
                chat_id: appState.currentChatId,
                user_id: appState.user.id,
                role: 'user',
                content: messageText,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (msgError) throw msgError;

        // Add to local state
        appState.messages.push(userMessage);

        // Get AI response with retry logic
        const aiResponse = await getAIResponseWithRetry(messageText);
        
        if (aiResponse) {
            // Display AI response
            displayAssistantMessage(aiResponse);
            
            // Save AI response to database
            const { data: assistantMessage, error: aiError } = await supabase
                .from('messages')
                .insert({
                    chat_id: appState.currentChatId,
                    user_id: appState.user.id,
                    role: 'assistant',
                    content: aiResponse,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (!aiError) {
                appState.messages.push(assistantMessage);
            }

            // Update chat title if it's the first message
            if (appState.messages.length <= 2) {
                await updateChatTitle(messageText);
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message. Please try again.', 'error');
    } finally {
        appState.isProcessing = false;
        clearMessageInput();
    }
}

async function getAIResponseWithRetry(message) {
    let retries = 0;
    const maxRetries = CONFIG.MAX_RETRIES;
    
    while (retries < maxRetries) {
        try {
            const response = await callOpenRouterAPI(message);
            appState.retryCount = 0; // Reset retry count on success
            return response;
        } catch (error) {
            retries++;
            console.error(`API call attempt ${retries} failed:`, error);
            
            if (retries < maxRetries) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * retries));
                
                // Refresh connection if needed
                if (appState.isConnectionStale()) {
                    await refreshConnection();
                }
            } else {
                throw error;
            }
        }
    }
}

async function callOpenRouterAPI(message) {
    const apiKey = appState.settings.openrouterKey || CONFIG.OPENROUTER_API_KEY;
    
    if (!apiKey) {
        throw new Error('OpenRouter API key not configured');
    }

    // Build conversation history for context
    const messages = [
        ...appState.messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: message }
    ];

    try {
        const response = await fetch(CONFIG.OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': '0xHiTek Chat'
            },
            body: JSON.stringify({
                model: appState.settings.selectedModel || CONFIG.DEFAULT_MODEL,
                messages: messages,
                max_tokens: appState.settings.maxTokens || 1000,
                temperature: appState.settings.temperature || 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Update token count
        if (data.usage) {
            appState.tokenCount += data.usage.total_tokens || 0;
            updateTokenDisplay();
        }

        return data.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
        console.error('OpenRouter API error:', error);
        throw error;
    }
}

async function refreshConnection() {
    try {
        // Re-authenticate session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            appState.user = session.user;
            appState.updateActivity();
            console.log('Connection refreshed');
        } else {
            // Session expired, need to re-login
            appState.user = null;
            updateUIState();
            showToast('Session expired. Please login again.', 'warning');
        }
    } catch (error) {
        console.error('Error refreshing connection:', error);
    }
}

async function updateChatTitle(firstMessage) {
    if (!appState.currentChatId) return;

    try {
        // Generate title from first message (truncate to 50 chars)
        const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
        
        const { error } = await supabase
            .from('chats')
            .update({ title: title })
            .eq('id', appState.currentChatId);

        if (!error) {
            await loadChatHistory();
        }
    } catch (error) {
        console.error('Error updating chat title:', error);
    }
}

// ============================================
// Admin Functions
// ============================================

async function loadAdminDashboard() {
    if (!appState.user) return;

    try {
        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', appState.user.id)
            .single();

        if (profile?.role !== 'admin' && appState.user.email !== 'admin@0xhitek.com') {
            showToast('Unauthorized access', 'error');
            return;
        }

        // Load statistics
        const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id');

        const { data: activeUsers, error: activeError } = await supabase
            .from('profiles')
            .select('id')
            .gte('updated_at', new Date(Date.now() - 86400000).toISOString());

        // Update dashboard UI
        if (document.getElementById('totalUsers')) {
            document.getElementById('totalUsers').textContent = users?.length || 0;
        }
        if (document.getElementById('totalMessages')) {
            document.getElementById('totalMessages').textContent = messages?.length || 0;
        }
        if (document.getElementById('activeToday')) {
            document.getElementById('activeToday').textContent = activeUsers?.length || 0;
        }

        // Populate users table
        if (users && document.getElementById('usersTableBody')) {
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.full_name || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${user.role || 'user'}</td>
                    <td>${user.message_count || 0}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="toggleUserRole('${user.id}')" class="btn btn-sm">
                            ${user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Show admin dashboard
        showAdminDashboard();
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showToast('Error loading admin data', 'error');
    }
}

async function toggleUserRole(userId) {
    try {
        const { data: user } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const newRole = user?.role === 'admin' ? 'user' : 'admin';

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) throw error;

        showToast(`User role updated to ${newRole}`, 'success');
        await loadAdminDashboard();
    } catch (error) {
        console.error('Error updating user role:', error);
        showToast('Error updating user role', 'error');
    }
}

// ============================================
// UI Helper Functions
// ============================================

function updateUIState() {
    // Update button visibility based on login state
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileBtn = document.getElementById('profileBtn');
    const adminBtn = document.getElementById('adminBtn');
    const userEmail = document.getElementById('userEmail');

    if (appState.user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (signupBtn) signupBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (profileBtn) profileBtn.style.display = 'block';
        if (userEmail) {
            userEmail.style.display = 'block';
            userEmail.textContent = appState.user.email;
        }

        // Check for admin
        if (appState.user.email === 'admin@0xhitek.com') {
            if (adminBtn) adminBtn.style.display = 'block';
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (signupBtn) signupBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (profileBtn) profileBtn.style.display = 'none';
        if (adminBtn) adminBtn.style.display = 'none';
        if (userEmail) userEmail.style.display = 'none';
    }
}

function displayUserMessage(text) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function displayAssistantMessage(text) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function displayMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    container.innerHTML = '';
    
    appState.messages.forEach(msg => {
        if (msg.role === 'user') {
            displayUserMessage(msg.content);
        } else {
            displayAssistantMessage(msg.content);
        }
    });
}

function clearChatDisplay() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.innerHTML = `
            <div class="message assistant">
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <p>Welcome to 0xHiTek! How can I help you today?</p>
                </div>
            </div>
        `;
    }
}

function clearMessageInput() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
}

function updateTokenDisplay() {
    const tokenDisplay = document.getElementById('tokenCount');
    if (tokenDisplay) {
        tokenDisplay.textContent = appState.tokenCount.toLocaleString();
    }
}

function updateChatHistoryUI() {
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        if (item.dataset.chatId === appState.currentChatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Modal functions (keep your existing modal code)
function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
}

function showAdminDashboard() {
    const dashboard = document.getElementById('adminDashboard');
    const chatContainer = document.getElementById('chatContainer');
    
    if (dashboard && chatContainer) {
        dashboard.classList.add('active');
        chatContainer.style.display = 'none';
    }
}

function hideAdminDashboard() {
    const dashboard = document.getElementById('adminDashboard');
    const chatContainer = document.getElementById('chatContainer');
    
    if (dashboard && chatContainer) {
        dashboard.classList.remove('active');
        chatContainer.style.display = 'flex';
    }
}

// ============================================
// Initialize App on Load
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        appState.user = session.user;
        await loadUserProfile();
        await loadChatHistory();
        appState.startKeepAlive();
        updateUIState();
    }

    // Setup auth state listener
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            appState.user = session.user;
            await loadUserProfile();
            await loadChatHistory();
            appState.startKeepAlive();
        } else {
            appState.user = null;
            appState.stopKeepAlive();
        }
        updateUIState();
    });

    // Load models
    loadModels();

    // Setup event listeners (add these to your existing HTML)
    setupEventListeners();
});

// ============================================
// Event Listeners Setup
// ============================================

function setupEventListeners() {
    // Message input
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(messageInput.value);
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            sendMessage(messageInput.value);
        });
    }

    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }

    // Auth form
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const isLogin = document.getElementById('authTitle').textContent === 'Login';
            
            if (isLogin) {
                await handleLogin(email, password);
            } else {
                const fullName = document.getElementById('authName').value;
                await handleSignup(email, password, fullName);
            }
        });
    }

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const profileData = {
                fullName: document.getElementById('profileName').value,
                openrouterKey: document.getElementById('openrouterKey').value,
                maxTokens: parseInt(document.getElementById('maxTokens').value),
                temperature: parseFloat(document.getElementById('temperature').value),
                selectedModel: document.getElementById('modelSelect').value
            };
            await saveProfile(profileData);
        });
    }

    // Model selector
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            appState.settings.selectedModel = e.target.value;
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Admin button
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', loadAdminDashboard);
    }
}

// ============================================
// Load Models Function
// ============================================

async function loadModels() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    try {
        // Predefined list of available models
        const models = [
            { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
            { id: 'openai/gpt-4', name: 'GPT-4' },
            { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'anthropic/claude-2', name: 'Claude 2' },
            { id: 'anthropic/claude-instant-v1', name: 'Claude Instant' },
            { id: 'google/palm-2-chat-bison', name: 'PaLM 2' },
            { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B' },
            { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B' }
        ];

        appState.models = models;
        
        modelSelect.innerHTML = models.map(model => 
            `<option value="${model.id}">${model.name}</option>`
        ).join('');

        // Set default or saved model
        modelSelect.value = appState.settings.selectedModel || CONFIG.DEFAULT_MODEL;
    } catch (error) {
        console.error('Error loading models:', error);
        modelSelect.innerHTML = '<option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Default)</option>';
    }
}
