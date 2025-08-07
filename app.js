// ============================================
// app.js - Complete Application Logic
// ============================================

// Initialize Supabase client
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ============================================
// State Management Class
// ============================================
class AppState {
    constructor() {
        this.user = null;
        this.currentChatId = null;
        this.messages = [];
        this.chats = [];
        this.settings = {
            openrouterKey: CONFIG.OPENROUTER_API_KEY,
            maxTokens: CONFIG.DEFAULT_MAX_TOKENS,
            temperature: CONFIG.DEFAULT_TEMPERATURE,
            selectedModel: CONFIG.DEFAULT_MODEL,
            showTimestamps: true,
            enableSounds: true
        };
        this.tokenCount = 0;
        this.isProcessing = false;
        this.keepAliveInterval = null;
        this.lastActivity = Date.now();
    }

    setUser(user) {
        this.user = user;
        this.updateUI();
    }

    updateUI() {
        const elements = {
            loginBtn: document.getElementById('loginBtn'),
            signupBtn: document.getElementById('signupBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            profileBtn: document.getElementById('profileBtn'),
            adminBtn: document.getElementById('adminBtn'),
            userInfo: document.getElementById('userInfo'),
            userEmail: document.getElementById('userEmail'),
            sendBtn: document.getElementById('sendBtn')
        };

        if (this.user) {
            // User is logged in
            elements.loginBtn.style.display = 'none';
            elements.signupBtn.style.display = 'none';
            elements.logoutBtn.style.display = 'block';
            elements.profileBtn.style.display = 'block';
            elements.userInfo.style.display = 'flex';
            elements.userEmail.textContent = this.user.email;
            elements.sendBtn.disabled = false;

            // Check if admin
            if (this.user.email === CONFIG.ADMIN_EMAIL || this.user.role === 'admin') {
                elements.adminBtn.style.display = 'block';
            }
        } else {
            // User is logged out
            elements.loginBtn.style.display = 'block';
            elements.signupBtn.style.display = 'block';
            elements.logoutBtn.style.display = 'none';
            elements.profileBtn.style.display = 'none';
            elements.adminBtn.style.display = 'none';
            elements.userInfo.style.display = 'none';
            elements.sendBtn.disabled = true;
        }
    }

    startKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }
        
        this.keepAliveInterval = setInterval(async () => {
            if (this.user && !this.isProcessing) {
                try {
                    // Simple ping to keep connection alive
                    await supabase.from('profiles').select('id').eq('id', this.user.id).limit(1).single();
                    this.lastActivity = Date.now();
                } catch (error) {
                    console.log('Keep-alive ping');
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

    isConnectionStale() {
        return (Date.now() - this.lastActivity) > 30000;
    }

    updateActivity() {
        this.lastActivity = Date.now();
    }
}

// Global state instance
const appState = new AppState();

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Hide loading screen after a short delay
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    }, 1500);

    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        appState.setUser(session.user);
        await loadUserProfile();
        await loadChatHistory();
        appState.startKeepAlive();
    }

    // Setup auth state listener
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            appState.setUser(session.user);
            await loadUserProfile();
            await loadChatHistory();
            appState.startKeepAlive();
        } else {
            appState.setUser(null);
            appState.stopKeepAlive();
            clearChatDisplay();
        }
    });

    // Initialize UI components
    initializeModels();
    setupEventListeners();
});

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('signupBtn').addEventListener('click', () => openAuthModal('signup'));
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Profile & Admin
    document.getElementById('profileBtn').addEventListener('click', openProfileModal);
    document.getElementById('adminBtn').addEventListener('click', openAdminDashboard);
    document.getElementById('closeAdminBtn')?.addEventListener('click', closeAdminDashboard);
    
    // Chat controls
    document.getElementById('newChatBtn').addEventListener('click', createNewChat);
    document.getElementById('sendBtn').addEventListener('click', () => sendMessage());
    
    // Message input
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });
    
    // Model selector
    document.getElementById('modelSelect').addEventListener('change', (e) => {
        appState.settings.selectedModel = e.target.value;
        if (appState.user) {
            saveUserSettings();
        }
    });
    
    // Auth form
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    document.getElementById('authToggleLink').addEventListener('click', toggleAuthMode);
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    
    // OAuth buttons
    document.getElementById('googleAuthBtn').addEventListener('click', () => handleOAuth('google'));
    document.getElementById('githubAuthBtn').addEventListener('click', () => handleOAuth('github'));
    
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
    document.getElementById('closeProfileModal').addEventListener('click', closeProfileModal);
    
    // Profile tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Temperature slider
    const tempSlider = document.getElementById('temperature');
    const tempValue = document.getElementById('temperatureValue');
    tempSlider.addEventListener('input', () => {
        tempValue.textContent = tempSlider.value;
    });
    
    // Admin settings
    document.getElementById('saveSystemSettings')?.addEventListener('click', saveSystemSettings);
}

// ============================================
// Authentication Functions
// ============================================
async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const isLogin = document.getElementById('authTitle').textContent === 'Login';
    
    try {
        if (isLogin) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            showToast('Login successful!', 'success');
            closeAuthModal();
        } else {
            const fullName = document.getElementById('authName').value;
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });
            
            if (error) throw error;
            
            // Create profile
            if (data.user) {
                await supabase.from('profiles').insert({
                    id: data.user.id,
                    email,
                    full_name: fullName,
                    openrouter_key: CONFIG.OPENROUTER_API_KEY,
                    role: email === CONFIG.ADMIN_EMAIL ? 'admin' : 'user',
                    settings: appState.settings
                });
            }
            
            showToast('Signup successful! Please check your email for verification.', 'success');
            closeAuthModal();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleOAuth(provider) {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
    } catch (error) {
        showToast(`OAuth error: ${error.message}`, 'error');
    }
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        appState.user = null;
        appState.currentChatId = null;
        appState.messages = [];
        appState.chats = [];
        
        clearChatDisplay();
        showToast('Logged out successfully', 'success');
    } catch (error) {
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
                    role: appState.user.email === CONFIG.ADMIN_EMAIL ? 'admin' : 'user',
                    settings: appState.settings
                })
                .select()
                .single();
            
            if (createError) throw createError;
            data = newProfile;
        }
        
        if (data) {
            // Update local settings
            if (data.openrouter_key) {
                appState.settings.openrouterKey = data.openrouter_key;
            }
            if (data.settings) {
                appState.settings = { ...appState.settings, ...data.settings };
            }
            
            // Update UI
            document.getElementById('profileName').value = data.full_name || '';
            document.getElementById('profileEmail').value = data.email;
            document.getElementById('openrouterKey').value = data.openrouter_key || '';
            document.getElementById('maxTokens').value = appState.settings.maxTokens;
            document.getElementById('temperature').value = appState.settings.temperature;
            document.getElementById('temperatureValue').textContent = appState.settings.temperature;
            document.getElementById('modelSelect').value = appState.settings.selectedModel;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    
    if (!appState.user) return;
    
    try {
        const profileData = {
            full_name: document.getElementById('profileName').value,
            openrouter_key: document.getElementById('openrouterKey').value,
            settings: {
                maxTokens: parseInt(document.getElementById('maxTokens').value),
                temperature: parseFloat(document.getElementById('temperature').value),
                selectedModel: document.getElementById('modelSelect').value,
                showTimestamps: document.getElementById('showTimestamps').checked,
                enableSounds: document.getElementById('enableSounds').checked
            }
        };
        
        const { error } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', appState.user.id);
        
        if (error) throw error;
        
        // Update local state
        appState.settings = { ...appState.settings, ...profileData.settings };
        appState.settings.openrouterKey = profileData.openrouter_key;
        
        showToast('Profile updated successfully', 'success');
        closeProfileModal();
    } catch (error) {
        showToast('Error updating profile', 'error');
    }
}

async function saveUserSettings() {
    if (!appState.user) return;
    
    try {
        await supabase
            .from('profiles')
            .update({ settings: appState.settings })
            .eq('id', appState.user.id);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// ============================================
// Chat Management
// ============================================
async function createNewChat() {
    if (!appState.user) {
        showToast('Please login to create a chat', 'warning');
        return;
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
        
        showToast('New chat created', 'success');
    } catch (error) {
        showToast('Error creating chat', 'error');
    }
}

async function loadChat(chatId) {
    if (!appState.user) return;
    
    try {
        // Load messages for this chat
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
            .limit(CONFIG.CHAT_HISTORY_LIMIT);
        
        if (error) throw error;
        
        appState.chats = data || [];
        displayChatHistory();
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

function displayChatHistory() {
    const historyList = document.getElementById('historyList');
    
    if (appState.chats.length === 0) {
        historyList.innerHTML = '<div class="chat-item">No chats yet</div>';
        return;
    }
    
    historyList.innerHTML = appState.chats.map(chat => `
        <div class="chat-item ${chat.id === appState.currentChatId ? 'active' : ''}" 
             onclick="loadChat('${chat.id}')"
             data-chat-id="${chat.id}">
            <div class="chat-item-title">${chat.title || 'New Chat'}</div>
            <div class="chat-item-date">${formatDate(chat.created_at)}</div>
        </div>
    `).join('');
}

function updateChatHistoryUI() {
    document.querySelectorAll('.chat-item').forEach(item => {
        if (item.dataset.chatId === appState.currentChatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

async function updateChatTitle(message) {
    if (!appState.currentChatId) return;
    
    try {
        const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        
        await supabase
            .from('chats')
            .update({ title })
            .eq('id', appState.currentChatId);
        
        await loadChatHistory();
    } catch (error) {
        console.error('Error updating chat title:', error);
    }
}

// ============================================
// Message Handling
// ============================================
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || appState.isProcessing) return;
    
    if (!appState.user) {
        showToast('Please login to send messages', 'warning');
        return;
    }
    
    // Check connection staleness
    if (appState.isConnectionStale()) {
        await refreshConnection();
    }
    
    appState.isProcessing = true;
    appState.updateActivity();
    
    try {
        // Create chat if none exists
        if (!appState.currentChatId) {
            await createNewChat();
        }
        
        // Clear input immediately
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Display user message
        displayMessage('user', message);
        
        // Save user message to database
        const { data: userMessage, error: msgError } = await supabase
            .from('messages')
            .insert({
                chat_id: appState.currentChatId,
                user_id: appState.user.id,
                role: 'user',
                content: message,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (msgError) throw msgError;
        
        appState.messages.push(userMessage);
        
        // Show typing indicator
        showTypingIndicator();
        
        // Get AI response
        const aiResponse = await getAIResponse(message);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        if (aiResponse) {
            // Display AI response
            displayMessage('assistant', aiResponse);
            
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
            
            // Update chat title if first message
            if (appState.messages.length <= 2) {
                await updateChatTitle(message);
            }
            
            // Play sound if enabled
            if (appState.settings.enableSounds) {
                playNotificationSound();
            }
        }
    } catch (error) {
        hideTypingIndicator();
        showToast('Error sending message: ' + error.message, 'error');
    } finally {
        appState.isProcessing = false;
    }
}

async function getAIResponse(message) {
    let retries = 0;
    const maxRetries = CONFIG.MAX_RETRIES;
    
    while (retries < maxRetries) {
        try {
            const response = await callOpenRouterAPI(message);
            return response;
        } catch (error) {
            retries++;
            
            if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * retries));
                
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
    
    // Build conversation history
    const messages = [
        ...appState.messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: message }
    ];
    
    // Check if we're on Netlify or localhost
    const isProduction = window.location.hostname.includes('netlify.app') || 
                        window.location.hostname.includes('0xhitek.com');
    
    const apiUrl = isProduction 
        ? '/.netlify/functions/openrouter-proxy'
        : CONFIG.OPENROUTER_API_URL;
    
    try {
        const requestBody = {
            model: appState.settings.selectedModel || CONFIG.DEFAULT_MODEL,
            messages: messages,
            max_tokens: appState.settings.maxTokens || CONFIG.DEFAULT_MAX_TOKENS,
            temperature: appState.settings.temperature || CONFIG.DEFAULT_TEMPERATURE
        };
        
        // Add API key to body if using Netlify function
        if (isProduction) {
            requestBody.apiKey = apiKey;
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: isProduction 
                ? { 'Content-Type': 'application/json' }
                : {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': '0xHiTek Chat'
                },
            body: JSON.stringify(requestBody)
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
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
            appState.user = session.user;
            appState.updateActivity();
        } else {
            appState.user = null;
            appState.updateUI();
            showToast('Session expired. Please login again.', 'warning');
        }
    } catch (error) {
        console.error('Error refreshing connection:', error);
    }
}

// ============================================
// UI Display Functions
// ============================================
function displayMessage(role, content) {
    const container = document.getElementById('messagesContainer');
    
    // Clear welcome message if exists
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = role === 'user' ? 'U' : '<i class="fas fa-robot"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    if (appState.settings.showTimestamps) {
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = formatTime(new Date());
        contentDiv.appendChild(timestamp);
    }
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    container.appendChild(messageDiv);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function displayMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    if (appState.messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h2>Welcome to 0xHiTek</h2>
                <p>Your gateway to AI models via OpenRouter</p>
                <div class="features">
                    <div class="feature">
                        <i class="fas fa-brain"></i>
                        <span>Multiple AI Models</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-cloud"></i>
                        <span>Cloud Storage</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-bolt"></i>
                        <span>Fast Response</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    appState.messages.forEach(msg => {
        displayMessage(msg.role, msg.content);
    });
}

function clearChatDisplay() {
    displayMessages();
}

function showTypingIndicator() {
    document.getElementById('typingIndicator').style.display = 'block';
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator').style.display = 'none';
}

function updateTokenDisplay() {
    document.getElementById('tokenCount').textContent = appState.tokenCount.toLocaleString();
}

// ============================================
// Admin Dashboard
// ============================================
async function openAdminDashboard() {
    if (!appState.user) return;
    
    try {
        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', appState.user.id)
            .single();
        
        if (profile?.role !== 'admin' && appState.user.email !== CONFIG.ADMIN_EMAIL) {
            showToast('Unauthorized access', 'error');
            return;
        }
        
        // Load statistics
        const { data: users } = await supabase.from('profiles').select('*');
        const { data: messages } = await supabase.from('messages').select('id');
        const { data: chats } = await supabase.from('chats').select('id');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: activeUsers } = await supabase
            .from('profiles')
            .select('id')
            .gte('updated_at', today.toISOString());
        
        // Update dashboard stats
        document.getElementById('totalUsers').textContent = users?.length || 0;
        document.getElementById('totalMessages').textContent = messages?.length || 0;
        document.getElementById('totalChats').textContent = chats?.length || 0;
        document.getElementById('activeToday').textContent = activeUsers?.length || 0;
        
        // Populate users table
        if (users) {
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.full_name || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${user.role || 'user'}</td>
                    <td>${user.message_count || 0}</td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>
                        <button class="btn btn-sm" onclick="toggleUserRole('${user.id}')">
                            ${user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        // Show dashboard
        document.getElementById('chatArea').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
    } catch (error) {
        showToast('Error loading admin dashboard', 'error');
    }
}

function closeAdminDashboard() {
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('chatArea').style.display = 'flex';
}

async function toggleUserRole(userId) {
    try {
        const { data: user } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        const newRole = user?.role === 'admin' ? 'user' : 'admin';
        
        await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);
        
        showToast(`User role updated to ${newRole}`, 'success');
        await openAdminDashboard(); // Refresh dashboard
    } catch (error) {
        showToast('Error updating user role', 'error');
    }
}

async function saveSystemSettings() {
    // Implement system settings save logic
    showToast('System settings saved', 'success');
}

// ============================================
// Modal Functions
// ============================================
function openAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const submitText = document.getElementById('authSubmitText');
    const nameGroup = document.getElementById('nameGroup');
    const toggleText = document.getElementById('authToggleText');
    const forgotPassword = document.getElementById('forgotPasswordLink');
    
    if (mode === 'login') {
        title.textContent = 'Login';
        subtitle.textContent = 'Welcome back! Please login to continue.';
        submitText.textContent = 'Login';
        nameGroup.style.display = 'none';
        toggleText.innerHTML = "Don't have an account? <a href='#' id='authToggleLink'>Sign up</a>";
        forgotPassword.style.display = 'block';
    } else {
        title.textContent = 'Sign Up';
        subtitle.textContent = 'Create your account to get started.';
        submitText.textContent = 'Sign Up';
        nameGroup.style.display = 'block';
        toggleText.innerHTML = "Already have an account? <a href='#' id='authToggleLink'>Login</a>";
        forgotPassword.style.display = 'none';
    }
    
    modal.classList.add('active');
    
    // Re-attach toggle listener
    document.getElementById('authToggleLink').addEventListener('click', toggleAuthMode);
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.getElementById('authForm').reset();
}

function toggleAuthMode(e) {
    e.preventDefault();
    const currentMode = document.getElementById('authTitle').textContent === 'Login' ? 'signup' : 'login';
    openAuthModal(currentMode);
}

function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// ============================================
// Utility Functions
// ============================================
function initializeModels() {
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = CONFIG.AVAILABLE_MODELS.map(model => 
        `<option value="${model.id}">${model.name}</option>`
    ).join('');
    
    modelSelect.value = appState.settings.selectedModel || CONFIG.DEFAULT_MODEL;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
    });
}

function playNotificationSound() {
    // Create and play a simple notification sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore errors if autoplay is blocked
}

// Make toggleUserRole available globally for onclick
window.toggleUserRole = toggleUserRole;
window.loadChat = loadChat;
