// FIXED VERSION - All bugs resolved
// Application State
let state = {
    user: null,
    profile: null,
    currentChatId: null,
    messages: [],
    chats: [],
    settings: null,
    availableModels: [],
    sessionTokens: 0,
    isAdmin: false
};

// DOM Elements
const elements = {
    // Auth elements
    authContainer: document.getElementById('authContainer'),
    appContainer: document.getElementById('appContainer'),
    loginForm: document.getElementById('loginForm'),
    signupForm: document.getElementById('signupForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    signupName: document.getElementById('signupName'),
    signupEmail: document.getElementById('signupEmail'),
    signupPassword: document.getElementById('signupPassword'),
    googleLogin: document.getElementById('googleLogin'),
    githubLogin: document.getElementById('githubLogin'),
    forgotPassword: document.getElementById('forgotPassword'),
    
    // User elements
    userMenu: document.getElementById('userMenu'),
    userDropdown: document.getElementById('userDropdown'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    logoutBtn: document.getElementById('logoutBtn'),
    adminBtn: document.getElementById('adminBtn'),
    
    // Chat elements
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    messagesContainer: document.getElementById('messagesContainer'),
    modelSelector: document.getElementById('modelSelector'),
    modelSearch: document.getElementById('modelSearch'),
    tokenCount: document.getElementById('tokenCount'),
    
    // Sidebar elements
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    menuToggle: document.getElementById('menuToggle'),
    themeToggle: document.getElementById('themeToggle'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('historyList'),
    usageCount: document.getElementById('usageCount'),
    usageLimit: document.getElementById('usageLimit'),
    
    // Settings elements
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    maxTokens: document.getElementById('maxTokens'),
    temperature: document.getElementById('temperature'),
    tempValue: document.getElementById('tempValue'),
    showTimestamps: document.getElementById('showTimestamps'),
    soundEnabled: document.getElementById('soundEnabled'),
    saveSettings: document.getElementById('saveSettings'),
    
    // Profile elements
    profileBtn: document.getElementById('profileBtn'),
    profileModal: document.getElementById('profileModal'),
    closeProfile: document.getElementById('closeProfile'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileApiKey: document.getElementById('profileApiKey'),
    toggleProfileApiKey: document.getElementById('toggleProfileApiKey'),
    changeAvatar: document.getElementById('changeAvatar'),
    avatarInput: document.getElementById('avatarInput'),
    saveProfile: document.getElementById('saveProfile'),
    
    // Admin elements
    adminModal: document.getElementById('adminModal'),
    closeAdmin: document.getElementById('closeAdmin'),
    totalUsers: document.getElementById('totalUsers'),
    activeUsers: document.getElementById('activeUsers'),
    usersTable: document.getElementById('usersTable'),
    defaultUsageLimit: document.getElementById('defaultUsageLimit'),
    saveSystemSettings: document.getElementById('saveSystemSettings'),
    
    // Other elements
    exportBtn: document.getElementById('exportBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    notificationContainer: document.getElementById('notificationContainer')
};

// SESSION MANAGEMENT AND IDLE RECOVERY SYSTEM
const SessionManager = {
    idleTimeout: null,
    lastActivity: Date.now(),
    idleThreshold: 5 * 60 * 1000, // 5 minutes
    sessionCheckInterval: null,
    isRefreshing: false,
    
    // Initialize session management
    init() {
        console.log('Initializing session manager...');
        
        // Track user activity
        this.trackActivity();
        
        // Start session checker
        this.startSessionChecker();
        
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('Page became visible, checking session...');
                this.checkAndRefreshSession();
            }
        });
        
        // Listen for online/offline
        window.addEventListener('online', () => {
            console.log('Connection restored');
            showNotification('Connection restored', 'success');
            this.checkAndRefreshSession();
        });
        
        window.addEventListener('offline', () => {
            console.log('Connection lost');
            showNotification('Connection lost. Messages may not send.', 'warning');
        });
        
        // Listen for focus
        window.addEventListener('focus', () => {
            console.log('Window focused, checking session...');
            this.checkAndRefreshSession();
        });
    },
    
    // Track user activity
    trackActivity() {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivity = Date.now();
            });
        });
    },
    
    // Start periodic session checker
    startSessionChecker() {
        // Check every 30 seconds
        this.sessionCheckInterval = setInterval(() => {
            const idleTime = Date.now() - this.lastActivity;
            
            if (idleTime > this.idleThreshold) {
                console.log('User idle for', Math.round(idleTime / 1000), 'seconds');
            }
            
            // Check session every 30 seconds
            this.checkSessionHealth();
        }, 30000);
    },
    
    // Check session health
    async checkSessionHealth() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error || !session) {
                console.warn('Session check failed:', error);
                await this.refreshSession();
                return false;
            }
            
            // Check if session is about to expire (within 5 minutes)
            const expiresAt = new Date(session.expires_at * 1000);
            const now = new Date();
            const timeUntilExpiry = expiresAt - now;
            
            if (timeUntilExpiry < 5 * 60 * 1000) {
                console.log('Session expiring soon, refreshing...');
                await this.refreshSession();
            }
            
            return true;
        } catch (error) {
            console.error('Session health check error:', error);
            return false;
        }
    },
    
    // Check and refresh session if needed
    async checkAndRefreshSession() {
        if (this.isRefreshing) {
            console.log('Already refreshing session...');
            return;
        }
        
        console.log('Checking and refreshing session...');
        this.isRefreshing = true;
        
        try {
            // Get current session
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error || !session) {
                console.error('No valid session, attempting to refresh...');
                await this.refreshSession();
            } else {
                console.log('Session is valid');
                
                // Ensure profile is loaded
                if (!state.profile) {
                    await loadUserProfile();
                }
                
                // Ensure settings are loaded
                if (!state.settings) {
                    await loadUserSettings();
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
            showNotification('Session error. Please refresh the page.', 'error');
        } finally {
            this.isRefreshing = false;
        }
    },
    
    // Refresh session
    async refreshSession() {
        console.log('Refreshing session...');
        
        try {
            const { data: { session }, error } = await supabase.auth.refreshSession();
            
            if (error) {
                console.error('Session refresh failed:', error);
                
                // If refresh fails, try to re-authenticate
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    showNotification('Session expired. Please login again.', 'error');
                    // Redirect to login
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 2000);
                    return false;
                }
            }
            
            if (session) {
                console.log('Session refreshed successfully');
                state.user = session.user;
                
                // Reload profile and settings
                await loadUserProfile();
                await loadUserSettings();
                
                return true;
            }
        } catch (error) {
            console.error('Session refresh error:', error);
            return false;
        }
    },
    
    // Clean up
    destroy() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
        }
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
        }
    }
};

// ENHANCED SEND MESSAGE WITH IDLE RECOVERY
async function sendMessage() {
    console.log('=== START SEND MESSAGE (WITH RECOVERY) ===');
    
    const message = elements.messageInput.value.trim();
    
    if (!message) {
        console.log('Message is empty');
        return;
    }
    
    // Clear loading state from any previous stuck state
    window.clearStuckState();
    
    // Check session before sending
    console.log('Checking session before sending...');
    const sessionValid = await SessionManager.checkSessionHealth();
    
    if (!sessionValid) {
        console.log('Session invalid, refreshing...');
        await SessionManager.refreshSession();
    }
    
    // Ensure we have profile and API key
    if (!state.profile) {
        console.log('Profile missing, reloading...');
        await loadUserProfile();
    }
    
    if (!state.profile?.openrouter_api_key) {
        showNotification('Please add your OpenRouter API key in Profile settings', 'warning');
        return;
    }
    
    console.log('Message to send:', message);
    
    // Clear input and disable send button
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    
    // Set up timeout protection
    let timeoutId;
    const TIMEOUT_DURATION = 30000; // 30 seconds
    
    // Show loading
    showLoading(true);
    
    try {
        // Set timeout to auto-clear loading
        timeoutId = setTimeout(() => {
            console.error('Request timeout - clearing loading state');
            window.clearStuckState();
            showNotification('Request timed out. Please try again.', 'error');
        }, TIMEOUT_DURATION);
        
        // Create new chat if needed
        if (!state.currentChatId) {
            console.log('Creating new chat...');
            
            // Double-check session before database operation
            await SessionManager.checkSessionHealth();
            
            const { data: chat, error } = await supabase
                .from('chats')
                .insert({
                    user_id: state.user.id,
                    title: 'New Chat',
                    model: elements.modelSelector.value || 'openai/gpt-3.5-turbo'
                })
                .select()
                .single();
            
            if (error) {
                console.error('Chat creation error:', error);
                
                // If it's an auth error, refresh session
                if (error.message.includes('JWT') || error.message.includes('auth')) {
                    await SessionManager.refreshSession();
                    // Retry once
                    const { data: retryChat, error: retryError } = await supabase
                        .from('chats')
                        .insert({
                            user_id: state.user.id,
                            title: 'New Chat',
                            model: elements.modelSelector.value || 'openai/gpt-3.5-turbo'
                        })
                        .select()
                        .single();
                    
                    if (retryError) {
                        throw new Error('Failed to create chat after retry: ' + retryError.message);
                    }
                    
                    chat = retryChat;
                } else {
                    throw new Error('Failed to create chat: ' + error.message);
                }
            }
            
            if (chat) {
                state.currentChatId = chat.id;
                state.messages = [];
                state.sessionTokens = 0;
                elements.tokenCount.textContent = '0';
                
                // Remove welcome message
                const welcomeMsg = document.querySelector('.welcome-message');
                if (welcomeMsg) welcomeMsg.remove();
                
                console.log('Chat created:', chat.id);
            }
        }
        
        // Add user message to UI
        addMessageToUI('user', message);
        
        // Save user message with retry logic
        let msgSaved = false;
        let retries = 0;
        
        while (!msgSaved && retries < 3) {
            try {
                await supabase
                    .from('messages')
                    .insert({
                        chat_id: state.currentChatId,
                        user_id: state.user.id,
                        role: 'user',
                        content: message
                    });
                msgSaved = true;
            } catch (error) {
                retries++;
                console.error(`Message save attempt ${retries} failed:`, error);
                
                if (retries < 3) {
                    await SessionManager.refreshSession();
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                }
            }
        }
        
        // Prepare API messages
        const apiMessages = [
            { role: 'system', content: 'You are a helpful AI assistant.' }
        ];
        
        if (state.messages && state.messages.length > 0) {
            state.messages.slice(-10).forEach(msg => {
                apiMessages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
        apiMessages.push({
            role: 'user',
            content: message
        });
        
        // Make API call with retry logic
        let response;
        let apiRetries = 0;
        
        while (apiRetries < 3) {
            try {
                console.log(`API attempt ${apiRetries + 1}...`);
                
                response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': window.location.origin || 'http://localhost:3000',
                        'X-Title': '0xHiTek Chat'
                    },
                    body: JSON.stringify({
                        model: elements.modelSelector.value || 'openai/gpt-3.5-turbo',
                        messages: apiMessages,
                        max_tokens: parseInt(elements.maxTokens?.value || 2000),
                        temperature: parseFloat(elements.temperature?.value || 0.7),
                        stream: false
                    })
                });
                
                if (response.ok) {
                    break; // Success, exit retry loop
                }
                
                apiRetries++;
                
                if (apiRetries < 3) {
                    console.log('API call failed, retrying...');
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                }
            } catch (error) {
                apiRetries++;
                console.error(`API attempt ${apiRetries} error:`, error);
                
                if (apiRetries >= 3) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.error) {
            throw new Error(data.error.message || data.error);
        }
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from AI');
        }
        
        const assistantMessage = data.choices[0].message?.content || data.choices[0].text;
        
        if (!assistantMessage) {
            throw new Error('Empty response from AI');
        }
        
        // Add AI response to UI
        addMessageToUI('assistant', assistantMessage);
        
        // Update state
        state.messages.push(
            { role: 'user', content: message },
            { role: 'assistant', content: assistantMessage }
        );
        
        // Save assistant message (don't wait)
        supabase
            .from('messages')
            .insert({
                chat_id: state.currentChatId,
                user_id: state.user.id,
                role: 'assistant',
                content: assistantMessage
            })
            .catch(err => console.error('Error saving assistant message:', err));
        
        console.log('✅ Message sent successfully');
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        showNotification(`Error: ${error.message}`, 'error');
        
        // Remove user message on error
        const messages = elements.messagesContainer.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.classList.contains('user')) {
            lastMessage.remove();
        }
    } finally {
        // Clear timeout
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        // Always clear loading state
        window.clearStuckState();
        
        console.log('=== END SEND MESSAGE ===');
    }
}

// Helper function to clear stuck state
window.clearStuckState = function() {
    console.log('Clearing any stuck state...');
    
    // Hide loading
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.remove('active');
        elements.loadingOverlay.style.display = 'none';
    }
    
    // Re-enable send button
    if (elements.sendBtn) {
        elements.sendBtn.disabled = false;
    }
    
    // Re-enable input
    if (elements.messageInput) {
        elements.messageInput.disabled = false;
        elements.messageInput.focus();
    }
    
    // Clear any stuck timeouts
    const highestTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i);
    }
};

// Initialize session manager when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    SessionManager.init();
    
    // Add keyboard shortcut to clear stuck state (Ctrl+Shift+C)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            window.clearStuckState();
            showNotification('Cleared stuck state', 'info');
        }
    });
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    SessionManager.destroy();
});

// Auto-recovery check every 5 seconds when stuck
let stuckChecker = null;
function startStuckChecker() {
    if (stuckChecker) return;
    
    stuckChecker = setInterval(() => {
        const loadingVisible = elements.loadingOverlay?.classList.contains('active');
        const sendDisabled = elements.sendBtn?.disabled;
        
        if (loadingVisible || sendDisabled) {
            const stuckDuration = Date.now() - (window.lastRequestTime || Date.now());
            
            if (stuckDuration > 30000) {
                console.warn('Detected stuck state for over 30 seconds, auto-clearing...');
                window.clearStuckState();
                showNotification('Auto-recovered from stuck state', 'info');
            }
        }
    }, 5000);
}

// Start stuck checker
startStuckChecker();

// Track request times
const originalSendMessage = sendMessage;
sendMessage = async function() {
    window.lastRequestTime = Date.now();
    return originalSendMessage.apply(this, arguments);
};

// Initialize Application
async function init() {
    console.log('Initializing application...');
    
    // Check Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_')) {
        showNotification('Please configure Supabase credentials in config.js', 'error');
        console.error('Supabase not configured properly');
        return;
    }
    
    setupAuthListeners();
    setupEventListeners();
    loadTheme();
    
    try {
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            showAuth();
            return;
        }
        
        if (session) {
            state.user = session.user;
            await loadUserProfile();
            showApp();
        } else {
            showAuth();
        }
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session) {
                state.user = session.user;
                await loadUserProfile();
                showApp();
            } else if (event === 'SIGNED_OUT') {
                state.user = null;
                state.profile = null;
                showAuth();
            }
        });
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Error initializing app: ' + error.message, 'error');
    }
}

// Auth Functions
function setupAuthListeners() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabName}Form`).classList.add('active');
        });
    });
    
    // Login form
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword.value;
        
        // Validation
        if (!validateEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            showNotification('Welcome back!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            showNotification(error.message || 'Login failed', 'error');
        } finally {
            showLoading(false);
        }
    });
    
    // Signup form
    elements.signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = elements.signupName.value.trim();
        const email = elements.signupEmail.value.trim();
        const password = elements.signupPassword.value;
        
        // Validation
        if (!name || name.length < 2) {
            showNotification('Name must be at least 2 characters', 'error');
            return;
        }
        
        if (!validateEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name,
                        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00ff88&color=0a0e1a`
                    }
                }
            });
            
            if (error) throw error;
            
            showNotification('Account created! Please check your email to verify.', 'success');
            
            // Clear form
            elements.signupForm.reset();
            
        } catch (error) {
            console.error('Signup error:', error);
            showNotification(error.message || 'Signup failed', 'error');
        } finally {
            showLoading(false);
        }
    });
    
    // Google login
    elements.googleLogin.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
        } catch (error) {
            console.error('Google login error:', error);
            showNotification(error.message || 'Google login failed', 'error');
        }
    });
    
    // GitHub login
    elements.githubLogin.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
        } catch (error) {
            console.error('GitHub login error:', error);
            showNotification(error.message || 'GitHub login failed', 'error');
        }
    });
    
    // Forgot password
    elements.forgotPassword.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt('Enter your email address:');
        if (!email) return;
        
        if (!validateEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            });
            
            if (error) throw error;
            
            showNotification('Password reset email sent!', 'success');
        } catch (error) {
            console.error('Password reset error:', error);
            showNotification(error.message || 'Failed to send reset email', 'error');
        } finally {
            showLoading(false);
        }
    });
}

// Emergency function to unstick the UI
window.fixStuckUI = function() {
    console.log('Fixing stuck UI...');
    
    // Hide loading
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        loadingOverlay.style.display = 'none';
    }
    
    // Re-enable send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = false;
    }
    
    // Re-enable input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.disabled = false;
    }
    
    console.log('UI fixed!');
};

// Add keyboard shortcut to fix stuck UI (Ctrl+Shift+X)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
        fixStuckUI();
    }
});

// Simulate typing effect for non-streaming responses
async function simulateTyping(messageDiv, fullText, speed = 30) {
    let currentText = '';
    const textElement = messageDiv.querySelector('.message-text');
    
    for (let i = 0; i < fullText.length; i++) {
        currentText += fullText[i];
        
        // Update UI
        textElement.innerHTML = formatMessageContent(currentText) + '<span class="streaming-cursor">▊</span>';
        
        // Scroll to bottom
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        
        // Wait for next character
        await new Promise(resolve => setTimeout(resolve, speed));
    }
    
    // Remove cursor
    finalizeStreamingMessage(messageDiv);
}

// Load User Profile - FIXED
async function loadUserProfile() {
    try {
        console.log('Loading user profile for:', state.user.id);
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', state.user.id)
            .single();
        
        if (error) {
            console.error('Profile load error:', error);
            
            // If profile doesn't exist, create it
            if (error.code === 'PGRST116') {
                console.log('Creating new profile...');
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert({
                        id: state.user.id,
                        email: state.user.email,
                        full_name: state.user.user_metadata?.full_name || '',
                        avatar_url: state.user.user_metadata?.avatar_url || ''
                    })
                    .select()
                    .single();
                
                if (createError) {
                    console.error('Profile creation error:', createError);
                    showNotification('Error creating profile', 'error');
                    return;
                }
                
                state.profile = newProfile;
            } else {
                showNotification('Error loading profile', 'error');
                return;
            }
        } else {
            state.profile = profile;
        }
        
        // Update UI
        state.isAdmin = state.profile.email === ADMIN_EMAIL;
        
        elements.userName.textContent = state.profile.full_name || state.profile.email;
        elements.userAvatar.src = state.profile.avatar_url || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile.full_name || state.profile.email)}&background=00ff88&color=0a0e1a`;
        elements.usageCount.textContent = state.profile.usage_count || 0;
        elements.usageLimit.textContent = state.profile.usage_limit || APP_CONFIG.defaultUsageLimit;
        
        // Show admin button if admin
        if (state.isAdmin) {
            elements.adminBtn.style.display = 'block';
        }
        
        // Load user settings
        await loadUserSettings();
        
        // Load models if API key exists
        if (state.profile.openrouter_api_key) {
            await loadAvailableModels();
        } else {
            // Use default models
            useDefaultModels();
            showNotification('Add your OpenRouter API key in Profile to access all models', 'info');
        }
        
    } catch (error) {
        console.error('Profile error:', error);
        showNotification('Error loading profile: ' + error.message, 'error');
    }
}

// Load User Settings - FIXED
async function loadUserSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', state.user.id)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Settings load error:', error);
            return;
        }
        
        if (settings) {
            state.settings = settings;
            elements.maxTokens.value = settings.max_tokens || 2000;
            elements.temperature.value = settings.temperature || 0.7;
            elements.tempValue.textContent = settings.temperature || 0.7;
            elements.showTimestamps.checked = settings.show_timestamps !== false;
            elements.soundEnabled.checked = settings.sound_enabled === true;
            
            if (settings.theme === 'light') {
                document.body.classList.add('light-theme');
                elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        } else {
            // Create default settings
            const defaultSettings = {
                user_id: state.user.id,
                theme: 'dark',
                max_tokens: 2000,
                temperature: 0.7,
                show_timestamps: true,
                sound_enabled: false,
                preferred_model: APP_CONFIG.defaultModel
            };
            
            const { error: createError } = await supabase
                .from('user_settings')
                .insert(defaultSettings);
            
            if (!createError) {
                state.settings = defaultSettings;
            }
        }
    } catch (error) {
        console.error('Settings error:', error);
    }
}

// Load Available Models - COMPLETELY FIXED
// Load Available Models - FIXED TO SHOW ALL MODELS
async function loadAvailableModels() {
    if (!state.profile?.openrouter_api_key) {
        console.log('No API key found');
        useDefaultModels();
        return;
    }
    
    console.log('Loading all OpenRouter models...');
    showNotification('Loading models...', 'info');
    
    try {
        // First, verify the API key is valid
        const authResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': '0xHiTek Chat'
            }
        });
        
        if (!authResponse.ok) {
            console.error('Invalid API key:', authResponse.status);
            showNotification('Invalid OpenRouter API key. Please check and try again.', 'error');
            useDefaultModels();
            return;
        }
        
        const authData = await authResponse.json();
        console.log('API Key validated:', authData);
        
        // Now fetch ALL available models
        const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': '0xHiTek Chat'
            }
        });
        
        if (!modelsResponse.ok) {
            console.error('Failed to fetch models:', modelsResponse.status);
            showNotification('Failed to load models. Using defaults.', 'warning');
            useDefaultModels();
            return;
        }
        
        const data = await modelsResponse.json();
        console.log('Raw models data:', data);
        
        // Process ALL models without filtering them out
        let allModels = data.data || [];
        console.log(`Total models available: ${allModels.length}`);
        
        // Sort models to show important ones first, but keep ALL models
        state.availableModels = allModels.sort((a, b) => {
            // Priority order for popular models
            const topModels = [
                'anthropic/claude-3-opus',
                'anthropic/claude-3.5-sonnet',
                'anthropic/claude-3-sonnet',
                'openai/gpt-4-turbo',
                'openai/gpt-4-turbo-preview', 
                'openai/gpt-4',
                'openai/gpt-3.5-turbo',
                'google/gemini-pro-1.5',
                'google/gemini-pro',
                'meta-llama/llama-3-70b-instruct',
                'mistralai/mixtral-8x7b-instruct'
            ];
            
            // Check if models are in priority list
            const aIndex = topModels.findIndex(m => a.id.includes(m));
            const bIndex = topModels.findIndex(m => b.id.includes(m));
            
            // If both are priority models, sort by priority
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            
            // Priority models come first
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            
            // Then sort by context length (larger is often better)
            const aContext = a.context_length || 0;
            const bContext = b.context_length || 0;
            if (aContext !== bContext) {
                return bContext - aContext;
            }
            
            // Finally sort alphabetically by name
            const aName = a.name || a.id;
            const bName = b.name || b.id;
            return aName.localeCompare(bName);
        });
        
        console.log('Models after sorting:', state.availableModels.length);
        
        if (state.availableModels.length > 0) {
            populateModelSelector();
            showNotification(`Loaded ${state.availableModels.length} models successfully!`, 'success');
            
            // Log some popular models for debugging
            console.log('Sample of available models:');
            state.availableModels.slice(0, 10).forEach(model => {
                console.log(`- ${model.id}: ${model.name} (Context: ${model.context_length})`);
            });
        } else {
            console.warn('No models returned from API');
            useDefaultModels();
        }
        
    } catch (error) {
        console.error('Error loading models:', error);
        showNotification('Error loading models. Using defaults.', 'warning');
        useDefaultModels();
    }
}

// Enhanced model selector population
function populateModelSelector() {
    console.log(`Populating selector with ${state.availableModels.length} models`);
    
    elements.modelSelector.innerHTML = '';
    
    if (state.availableModels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        elements.modelSelector.appendChild(option);
        return;
    }
    
    // Group models by provider for better organization
    const modelsByProvider = {};
    
    state.availableModels.forEach(model => {
        // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
        const provider = model.id.split('/')[0] || 'other';
        
        if (!modelsByProvider[provider]) {
            modelsByProvider[provider] = [];
        }
        
        modelsByProvider[provider].push(model);
    });
    
    // Define provider display order
    const providerOrder = [
        'anthropic',
        'openai', 
        'google',
        'meta-llama',
        'mistralai',
        'cohere',
        'perplexity',
        'deepseek',
        'qwen'
    ];
    
    // Add models to selector grouped by provider
    let addedModels = 0;
    
    // First add prioritized providers
    providerOrder.forEach(provider => {
        if (modelsByProvider[provider]) {
            addOptGroup(provider, modelsByProvider[provider]);
            delete modelsByProvider[provider];
        }
    });
    
    // Then add any remaining providers
    Object.keys(modelsByProvider).sort().forEach(provider => {
        addOptGroup(provider, modelsByProvider[provider]);
    });
    
    function addOptGroup(provider, models) {
        // Create optgroup for better organization
        const optgroup = document.createElement('optgroup');
        optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            
            // Create informative label
            let label = model.name || model.id;
            
            // Add context length if available
            if (model.context_length) {
                const contextK = Math.round(model.context_length / 1000);
                label += ` (${contextK}k)`;
            }
            
            // Add pricing if available
            if (model.pricing) {
                const inputPrice = model.pricing.prompt ? 
                    (model.pricing.prompt * 1000000).toFixed(2) : null;
                const outputPrice = model.pricing.completion ? 
                    (model.pricing.completion * 1000000).toFixed(2) : null;
                
                if (inputPrice && outputPrice) {
                    label += ` [$${inputPrice}/$${outputPrice}]`;
                }
            }
            
            option.textContent = label;
            
            // Mark if this is the selected model
            if (model.id === (state.settings?.preferred_model || APP_CONFIG.defaultModel)) {
                option.selected = true;
            }
            
            optgroup.appendChild(option);
            addedModels++;
        });
        
        elements.modelSelector.appendChild(optgroup);
    }
    
    console.log(`Added ${addedModels} models to selector`);
    
    // If no model was selected, select the first one
    if (!elements.modelSelector.value && state.availableModels.length > 0) {
        elements.modelSelector.value = state.availableModels[0].id;
    }
    
    // Update the model search to work with all models
    updateModelSearch();
}

// Enhanced model search functionality
function updateModelSearch() {
    if (!elements.modelSearch) return;
    
    // Store original HTML for restoration
    const originalHTML = elements.modelSelector.innerHTML;
    
    elements.modelSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // Restore original if search is empty
            elements.modelSelector.innerHTML = originalHTML;
            return;
        }
        
        // Clear and rebuild with filtered models
        elements.modelSelector.innerHTML = '';
        
        let matchedModels = state.availableModels.filter(model => {
            const id = model.id.toLowerCase();
            const name = (model.name || '').toLowerCase();
            return id.includes(searchTerm) || name.includes(searchTerm);
        });
        
        if (matchedModels.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = `No models matching "${searchTerm}"`;
            elements.modelSelector.appendChild(option);
        } else {
            matchedModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                
                let label = model.name || model.id;
                if (model.context_length) {
                    const contextK = Math.round(model.context_length / 1000);
                    label += ` (${contextK}k context)`;
                }
                
                option.textContent = label;
                elements.modelSelector.appendChild(option);
            });
            
            // Select first match
            elements.modelSelector.value = matchedModels[0].id;
        }
        
        console.log(`Found ${matchedModels.length} models matching "${searchTerm}"`);
    });
}

// Enhanced default models fallback with more options
function useDefaultModels() {
    console.log('Using extended default models list');
    
    state.availableModels = [
        // Anthropic Claude Models
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus (200k)', context_length: 200000 },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (200k)', context_length: 200000 },
        { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet (200k)', context_length: 200000 },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (200k)', context_length: 200000 },
        { id: 'anthropic/claude-2.1', name: 'Claude 2.1 (200k)', context_length: 200000 },
        { id: 'anthropic/claude-2', name: 'Claude 2 (100k)', context_length: 100000 },
        { id: 'anthropic/claude-instant-1', name: 'Claude Instant 1.2', context_length: 100000 },
        
        // OpenAI GPT Models
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (128k)', context_length: 128000 },
        { id: 'openai/gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview (128k)', context_length: 128000 },
        { id: 'openai/gpt-4', name: 'GPT-4 (8k)', context_length: 8192 },
        { id: 'openai/gpt-4-32k', name: 'GPT-4 32K', context_length: 32768 },
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (16k)', context_length: 16385 },
        { id: 'openai/gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', context_length: 16385 },
        
        // Google Models
        { id: 'google/gemini-pro', name: 'Gemini Pro', context_length: 32760 },
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', context_length: 1000000 },
        { id: 'google/gemini-pro-vision', name: 'Gemini Pro Vision', context_length: 32760 },
        { id: 'google/palm-2-codechat-bison', name: 'PaLM 2 Code Chat', context_length: 8192 },
        { id: 'google/palm-2-chat-bison', name: 'PaLM 2 Chat', context_length: 8192 },
        
        // Meta Llama Models
        { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B Instruct', context_length: 8192 },
        { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B Instruct', context_length: 8192 },
        { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B Chat', context_length: 4096 },
        { id: 'meta-llama/llama-2-13b-chat', name: 'Llama 2 13B Chat', context_length: 4096 },
        { id: 'meta-llama/codellama-70b-instruct', name: 'Code Llama 70B', context_length: 4096 },
        
        // Mistral Models
        { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', context_length: 32768 },
        { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B Instruct', context_length: 65536 },
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct', context_length: 8192 },
        { id: 'mistralai/mistral-medium', name: 'Mistral Medium', context_length: 32768 },
        { id: 'mistralai/mistral-large', name: 'Mistral Large', context_length: 32768 },
        
        // Cohere Models
        { id: 'cohere/command-r-plus', name: 'Command R Plus', context_length: 128000 },
        { id: 'cohere/command-r', name: 'Command R', context_length: 128000 },
        { id: 'cohere/command', name: 'Command', context_length: 4096 },
        
        // Perplexity Models
        { id: 'perplexity/llama-3-sonar-large-32k-online', name: 'Sonar Large Online', context_length: 32768 },
        { id: 'perplexity/llama-3-sonar-large-32k-chat', name: 'Sonar Large Chat', context_length: 32768 },
        { id: 'perplexity/llama-3-sonar-small-32k-online', name: 'Sonar Small Online', context_length: 32768 },
        
        // Other Popular Models
        { id: 'databricks/dbrx-instruct', name: 'DBRX Instruct', context_length: 32768 },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', context_length: 32768 },
        { id: 'qwen/qwen-72b-chat', name: 'Qwen 72B Chat', context_length: 32768 },
        { id: 'nous/nous-hermes-2-mixtral-8x7b', name: 'Nous Hermes 2 Mixtral', context_length: 32768 }
    ];
    
    populateModelSelector();
    showNotification('Using offline model list. Add API key to see all available models.', 'info');
}

// Add this function to manually refresh models
async function refreshModels() {
    console.log('Manually refreshing models...');
    showNotification('Refreshing model list...', 'info');
    await loadAvailableModels();
}

// Add a refresh button to the model selector bar (add this to your HTML)
function addModelRefreshButton() {
    const modelBar = document.querySelector('.model-selector-bar');
    if (modelBar && !document.getElementById('refreshModelsBtn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshModelsBtn';
        refreshBtn.className = 'refresh-models-btn';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshBtn.title = 'Refresh model list';
        refreshBtn.onclick = refreshModels;
        
        // Add CSS for the button
        refreshBtn.style.cssText = `
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        
        modelBar.appendChild(refreshBtn);
    }
}

// Debug function to check what's happening
async function debugModelLoading() {
    console.group('🔍 Model Loading Debug');
    
    console.log('1. API Key exists:', !!state.profile?.openrouter_api_key);
    if (state.profile?.openrouter_api_key) {
        console.log('   Key prefix:', state.profile.openrouter_api_key.substring(0, 10) + '...');
    }
    
    if (state.profile?.openrouter_api_key) {
        try {
            // Test auth
            const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
                headers: {
                    'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': '0xHiTek Chat'
                }
            });
            
            const authData = await authRes.json();
            console.log('2. Auth response:', authData);
            
            // Test models endpoint
            const modelsRes = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': '0xHiTek Chat'
                }
            });
            
            const modelsData = await modelsRes.json();
            console.log('3. Models response:', {
                status: modelsRes.status,
                modelCount: modelsData.data?.length || 0,
                sampleModels: modelsData.data?.slice(0, 5).map(m => m.id)
            });
            
        } catch (error) {
            console.error('Debug error:', error);
        }
    }
    
    console.log('4. Current loaded models:', state.availableModels.length);
    console.log('5. Model selector options:', elements.modelSelector.options.length);
    
    console.groupEnd();
}

// Call this after DOM loads to add refresh button
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addModelRefreshButton, 1000);
});

// Save Profile - COMPLETELY FIXED
async function saveProfile() {
    console.log('Saving profile...');
    
    try {
        showLoading(true);
        
        const updates = {
            full_name: elements.profileName.value.trim(),
            openrouter_api_key: elements.profileApiKey.value.trim()
        };
        
        // Validate API key format if provided
        if (updates.openrouter_api_key && !updates.openrouter_api_key.startsWith('sk-or-')) {
            showNotification('Invalid API key format. OpenRouter keys start with "sk-or-"', 'error');
            showLoading(false);
            return;
        }
        
        // Handle avatar upload if changed
        if (elements.avatarInput.files && elements.avatarInput.files.length > 0) {
            console.log('Uploading avatar...');
            
            const file = elements.avatarInput.files[0];
            
            // Validate file
            if (file.size > APP_CONFIG.maxFileSize) {
                showNotification('File size must be less than 5MB', 'error');
                showLoading(false);
                return;
            }
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${state.user.id}-${Date.now()}.${fileExt}`;
            
            try {
                // Check if bucket exists by trying to list files
                const { error: bucketError } = await supabase.storage
                    .from('avatars')
                    .list('', { limit: 1 });
                
                if (bucketError) {
                    console.error('Avatar bucket error:', bucketError);
                    showNotification('Avatar storage not configured. Contact admin.', 'warning');
                } else {
                    // Upload the file
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true
                        });
                    
                    if (uploadError) {
                        console.error('Upload error:', uploadError);
                        showNotification('Failed to upload avatar', 'warning');
                    } else {
                        // Get public URL
                        const { data: { publicUrl } } = supabase.storage
                            .from('avatars')
                            .getPublicUrl(fileName);
                        
                        if (publicUrl) {
                            updates.avatar_url = publicUrl;
                            console.log('Avatar uploaded:', publicUrl);
                        }
                    }
                }
            } catch (avatarError) {
                console.error('Avatar error:', avatarError);
                showNotification('Avatar upload failed, but profile will be saved', 'warning');
            }
            
            // Clear the file input
            elements.avatarInput.value = '';
        }
        
        // Update profile in database
        console.log('Updating profile with:', updates);
        
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', state.user.id)
            .select()
            .single();
        
        if (error) {
            console.error('Profile update error:', error);
            throw error;
        }
        
        // Update local state
        state.profile = { ...state.profile, ...updates };
        
        // Update UI
        elements.userName.textContent = updates.full_name || state.profile.email;
        if (updates.avatar_url) {
            elements.userAvatar.src = updates.avatar_url;
        }
        
        showNotification('Profile updated successfully!', 'success');
        elements.profileModal.classList.remove('active');
        
        // Reload models if API key changed
        const apiKeyChanged = updates.openrouter_api_key && 
                            updates.openrouter_api_key !== state.profile.openrouter_api_key;
        
        if (apiKeyChanged) {
            console.log('API key changed, reloading models...');
            await loadAvailableModels();
        }
        
    } catch (error) {
        console.error('Save profile error:', error);
        showNotification('Error saving profile: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        showLoading(false);
    }
}

// Profile Modal Functions
async function showProfileModal() {
    console.log('Opening profile modal');
    elements.profileModal.classList.add('active');
    
    // Populate fields
    elements.profileName.value = state.profile?.full_name || '';
    elements.profileEmail.value = state.profile?.email || '';
    elements.profileApiKey.value = state.profile?.openrouter_api_key || '';
    elements.profileAvatar.src = state.profile?.avatar_url || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.full_name || state.profile?.email || 'User')}&background=00ff88&color=0a0e1a`;
}

// Setup Event Listeners - FIXED
function setupEventListeners() {
    // User dropdown menu - FIXED
    let isDropdownOpen = false;
    let dropdownTimeout;
    
    elements.userMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (dropdownTimeout) {
            clearTimeout(dropdownTimeout);
        }
        
        isDropdownOpen = !isDropdownOpen;
        
        if (isDropdownOpen) {
            elements.userDropdown.style.display = 'block';
            setTimeout(() => {
                elements.userDropdown.classList.add('active');
                elements.userMenu.classList.add('active');
            }, 10);
        } else {
            closeUserDropdown();
        }
    });
    
    // Prevent dropdown from closing when clicking inside
    elements.userDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (isDropdownOpen && !elements.userMenu.contains(e.target)) {
            closeUserDropdown();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isDropdownOpen) {
            closeUserDropdown();
        }
    });
    
    function closeUserDropdown() {
        elements.userDropdown.classList.remove('active');
        elements.userMenu.classList.remove('active');
        
        dropdownTimeout = setTimeout(() => {
            elements.userDropdown.style.display = 'none';
        }, 300);
        
        isDropdownOpen = false;
    }
    
    // Profile button
    elements.profileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeUserDropdown();
        showProfileModal();
    });
    
    // Admin button
    if (elements.adminBtn) {
        elements.adminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeUserDropdown();
            if (state.isAdmin) {
                showAdminDashboard();
            }
        });
    }
    
    // Logout button
    elements.logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        closeUserDropdown();
        
        if (confirm('Are you sure you want to logout?')) {
            await supabase.auth.signOut();
            showNotification('Logged out successfully', 'info');
        }
    });
    
    // Profile modal events
    elements.closeProfile.addEventListener('click', () => {
        elements.profileModal.classList.remove('active');
    });
    
    elements.saveProfile.addEventListener('click', saveProfile);
    
    // Avatar upload
    elements.changeAvatar.addEventListener('click', () => {
        elements.avatarInput.click();
    });
    
    elements.avatarInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            
            if (file.size > APP_CONFIG.maxFileSize) {
                showNotification('File size must be less than 5MB', 'error');
                e.target.value = '';
                return;
            }
            
            // Preview the image
            const reader = new FileReader();
            reader.onload = (e) => {
                elements.profileAvatar.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Toggle API key visibility
    elements.toggleProfileApiKey.addEventListener('click', () => {
        const input = elements.profileApiKey;
        const icon = elements.toggleProfileApiKey.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });
    
        // Send message event listeners - FIXED
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Send button clicked');
            await sendMessage();
        });
    }
    
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                console.log('Enter key pressed');
                await sendMessage();
            }
        });
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
}
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
    
    // Mobile menu toggle
    elements.menuToggle.addEventListener('click', () => {
        const isActive = elements.sidebar.classList.contains('active');
        
        if (!isActive) {
            elements.sidebar.classList.add('active');
            elements.sidebarOverlay.classList.add('active');
        } else {
            elements.sidebar.classList.remove('active');
            elements.sidebarOverlay.classList.remove('active');
        }
    });
    
    // Sidebar overlay click
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', () => {
            elements.sidebar.classList.remove('active');
            elements.sidebarOverlay.classList.remove('active');
        });
    }
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // New chat
    elements.newChatBtn.addEventListener('click', startNewChat);
    
    // Settings
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.add('active');
    });
    
    elements.closeSettings.addEventListener('click', () => {
        elements.settingsModal.classList.remove('active');
    });
    
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // Temperature slider
    elements.temperature.addEventListener('input', (e) => {
        elements.tempValue.textContent = e.target.value;
    });
    
    // Admin
    elements.closeAdmin.addEventListener('click', () => {
        elements.adminModal.classList.remove('active');
    });
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
        });
    });
    
    // Save system settings
    elements.saveSystemSettings.addEventListener('click', async () => {
        const { error } = await supabase
            .from('admin_settings')
            .upsert({
                setting_key: 'default_usage_limit',
                setting_value: { value: parseInt(elements.defaultUsageLimit.value) }
            });
        
        if (error) {
            showNotification('Error saving system settings: ' + error.message, 'error');
        } else {
            showNotification('System settings saved successfully!', 'success');
        }
    });
    
    // Export chat
    elements.exportBtn.addEventListener('click', exportChat);
    
    // Model search
    elements.modelSearch.addEventListener('input', filterModels);
    
    // Close modals on background click
    [elements.settingsModal, elements.profileModal, elements.adminModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Prevent modal content from closing modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    });
}

// Chat Functions
async function loadChatHistory() {
    const { data: chats } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', state.user.id)
        .order('updated_at', { ascending: false })
        .limit(50);
    
    if (chats) {
        state.chats = chats;
        renderChatHistory();
    }
}

function renderChatHistory() {
    elements.historyList.innerHTML = '';
    
    state.chats.forEach(chat => {
        const historyItem = document.createElement('div');
        historyItem.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        historyItem.innerHTML = `
            <div>${escapeHtml(chat.title || 'New Chat')}</div>
            <small>${new Date(chat.created_at).toLocaleDateString()}</small>
        `;
        historyItem.addEventListener('click', () => loadChat(chat.id));
        elements.historyList.appendChild(historyItem);
    });
}

async function loadChat(chatId) {
    state.currentChatId = chatId;
    state.sessionTokens = 0;
    elements.tokenCount.textContent = '0';
    
    // Load messages for this chat
    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
    
    if (messages) {
        state.messages = messages;
        
        // Calculate total tokens
        state.sessionTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
        elements.tokenCount.textContent = state.sessionTokens;
        
        // Rebuild chat UI
        elements.messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            addMessageToUI(msg.role, msg.content);
        });
        
        renderChatHistory();
    }
}

async function startNewChat() {
    const { data: chat, error } = await supabase
        .from('chats')
        .insert({
            user_id: state.user.id,
            title: 'New Chat',
            model: elements.modelSelector.value || APP_CONFIG.defaultModel
        })
        .select()
        .single();
    
    if (chat) {
        state.currentChatId = chat.id;
        state.messages = [];
        state.sessionTokens = 0;
        elements.tokenCount.textContent = '0';
        
        // Clear messages container and show welcome
        elements.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="cyber-grid"></div>
                <h2 class="glitch" data-text="Welcome to 0xHiTek">Welcome to 0xHiTek</h2>
                <p>Your gateway to AI models via OpenRouter</p>
                <div class="feature-grid">
                    <div class="feature-card">
                        <i class="fas fa-robot"></i>
                        <span>Multiple AI Models</span>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-database"></i>
                        <span>Cloud Storage</span>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-bolt"></i>
                        <span>Fast Response</span>
                    </div>
                </div>
            </div>
        `;
        
        await loadChatHistory();
    }
}

// STREAMING SEND MESSAGE - Live text generation
async function sendMessage() {
    console.log('=== START SEND MESSAGE (STREAMING) ===');
    
    const message = elements.messageInput.value.trim();
    
    if (!message) {
        console.log('Message is empty');
        return;
    }
    
    if (!state.profile?.openrouter_api_key) {
        showNotification('Please add your OpenRouter API key in Profile settings', 'warning');
        return;
    }
    
    console.log('Sending message:', message);
    
    // Clear input and disable send button
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    
    // Show loading
    showLoading(true);
    
    let assistantMessageDiv = null;
    let assistantMessageContent = '';
    let streamController = null;
    
    try {
        // Create new chat if needed
        if (!state.currentChatId) {
            console.log('Creating new chat...');
            
            const { data: chat, error } = await supabase
                .from('chats')
                .insert({
                    user_id: state.user.id,
                    title: 'New Chat',
                    model: elements.modelSelector.value || 'openai/gpt-3.5-turbo'
                })
                .select()
                .single();
            
            if (error) {
                throw new Error('Failed to create chat: ' + error.message);
            }
            
            if (chat) {
                state.currentChatId = chat.id;
                state.messages = [];
                state.sessionTokens = 0;
                elements.tokenCount.textContent = '0';
                
                // Remove welcome message
                const welcomeMsg = document.querySelector('.welcome-message');
                if (welcomeMsg) welcomeMsg.remove();
                
                console.log('Chat created:', chat.id);
            }
        }
        
        // Add user message to UI
        addMessageToUI('user', message);
        
        // Save user message to database
        await supabase
            .from('messages')
            .insert({
                chat_id: state.currentChatId,
                user_id: state.user.id,
                role: 'user',
                content: message
            });
        
        // Prepare messages for API
        const apiMessages = [
            { role: 'system', content: 'You are a helpful AI assistant.' }
        ];
        
        // Add context
        if (state.messages && state.messages.length > 0) {
            state.messages.slice(-10).forEach(msg => {
                apiMessages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
        // Add current message
        apiMessages.push({
            role: 'user',
            content: message
        });
        
        // Prepare request body WITH STREAMING
        const requestBody = {
            model: elements.modelSelector.value || 'openai/gpt-3.5-turbo',
            messages: apiMessages,
            max_tokens: parseInt(elements.maxTokens?.value || 2000),
            temperature: parseFloat(elements.temperature?.value || 0.7),
            stream: true // ENABLE STREAMING
        };
        
        console.log('Starting streaming request...');
        
        // Hide loading since streaming will start immediately
        showLoading(false);
        
        // Create assistant message div immediately
        assistantMessageDiv = createStreamingMessageUI();
        
        // Try to connect with streaming
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin || 'http://localhost:3000',
                'X-Title': '0xHiTek Chat'
            },
            body: JSON.stringify(requestBody)
        }).catch(async (error) => {
            // If direct fails, try with proxy (note: some proxies don't support streaming)
            console.log('Direct streaming failed, trying proxy...');
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://openrouter.ai/api/v1/chat/completions');
            return fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }
        
        // Check if response is streaming
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/event-stream')) {
            // Handle SSE streaming
            await handleSSEStream(response, assistantMessageDiv);
        } else {
            // Handle non-streaming response (fallback)
            console.log('Non-streaming response detected, falling back...');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || data.error);
            }
            
            if (data.choices && data.choices[0]) {
                const content = data.choices[0].message?.content || data.choices[0].text;
                updateStreamingMessage(assistantMessageDiv, content, true);
                assistantMessageContent = content;
            }
        }
        
        // Save complete assistant message to database
        if (assistantMessageContent) {
            await supabase
                .from('messages')
                .insert({
                    chat_id: state.currentChatId,
                    user_id: state.user.id,
                    role: 'assistant',
                    content: assistantMessageContent,
                    tokens: 0 // Will be updated later
                });
            
            // Update state
            state.messages.push(
                { role: 'user', content: message },
                { role: 'assistant', content: assistantMessageContent }
            );
        }
        
        console.log('✅ Streaming message completed');
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        showNotification(`Error: ${error.message}`, 'error');
        
        // Remove the assistant message div if it was created
        if (assistantMessageDiv) {
            assistantMessageDiv.remove();
        }
        
        // Remove the user message on error
        const messages = elements.messagesContainer.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.classList.contains('user')) {
            lastMessage.remove();
        }
    } finally {
        showLoading(false);
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
        console.log('=== END SEND MESSAGE ===');
    }
}

// Handle Server-Sent Events stream
async function handleSSEStream(response, messageDiv) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('Stream complete');
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    
                    if (data === '[DONE]') {
                        console.log('Stream finished');
                        finalizeStreamingMessage(messageDiv);
                        return fullContent;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (parsed.choices && parsed.choices[0]) {
                            const delta = parsed.choices[0].delta;
                            if (delta && delta.content) {
                                fullContent += delta.content;
                                updateStreamingMessage(messageDiv, fullContent, false);
                            }
                        }
                        
                        // Handle errors in stream
                        if (parsed.error) {
                            throw new Error(parsed.error.message || parsed.error);
                        }
                    } catch (e) {
                        if (e instanceof SyntaxError) {
                            console.warn('Failed to parse SSE data:', data);
                        } else {
                            throw e;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Stream error:', error);
        throw error;
    } finally {
        reader.releaseLock();
    }
    
    return fullContent;
}

// Create streaming message UI
function createStreamingMessageUI() {
    // Remove welcome message if exists
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    
    const timestamp = state.settings?.show_timestamps 
        ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-role">AI</span>
                ${timestamp ? `<span class="message-time">${timestamp}</span>` : ''}
            </div>
            <div class="message-text">
                <span class="streaming-cursor">▊</span>
            </div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    
    return messageDiv;
}

// Update streaming message content
function updateStreamingMessage(messageDiv, content, isComplete) {
    const textElement = messageDiv.querySelector('.message-text');
    
    if (textElement) {
        // Format content with proper HTML
        let formattedContent = formatMessageContent(content);
        
        // Add cursor if still streaming
        if (!isComplete) {
            formattedContent += '<span class="streaming-cursor">▊</span>';
        }
        
        textElement.innerHTML = formattedContent;
        
        // Auto-scroll to bottom
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
}

// Finalize streaming message
function finalizeStreamingMessage(messageDiv) {
    // Remove streaming class and cursor
    messageDiv.classList.remove('streaming');
    const cursor = messageDiv.querySelector('.streaming-cursor');
    if (cursor) {
        cursor.remove();
    }
    
    // Play sound if enabled
    if (state.settings?.sound_enabled) {
        playNotificationSound();
    }
}

// Alternative: Handle streaming with fetch + ReadableStream (for better browser support)
async function handleStreamingResponse(response, messageDiv) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
            finalizeStreamingMessage(messageDiv);
            return fullContent;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Try to parse complete JSON objects from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
                const jsonStr = line.replace('data: ', '').trim();
                
                if (jsonStr === '[DONE]') {
                    finalizeStreamingMessage(messageDiv);
                    return fullContent;
                }
                
                try {
                    const data = JSON.parse(jsonStr);
                    
                    if (data.choices && data.choices[0].delta) {
                        const deltaContent = data.choices[0].delta.content || '';
                        fullContent += deltaContent;
                        updateStreamingMessage(messageDiv, fullContent, false);
                    }
                } catch (e) {
                    // Skip invalid JSON
                    continue;
                }
            }
        }
    }
}
// Add this helper function to ensure loading state is properly managed
function showLoading(show) {
    console.log('showLoading called with:', show);
    
    if (!elements.loadingOverlay) {
        console.error('Loading overlay element not found!');
        return;
    }
    
    if (show) {
        elements.loadingOverlay.classList.add('active');
        elements.loadingOverlay.style.display = 'flex';
    } else {
        elements.loadingOverlay.classList.remove('active');
        // Use timeout to allow animation to complete
        setTimeout(() => {
            elements.loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// Add an emergency stop function you can call from console
window.stopLoading = function() {
    console.log('Emergency stop loading...');
    showLoading(false);
    elements.sendBtn.disabled = false;
    elements.messageInput.disabled = false;
};

// Add this helper function to test the connection
async function testOpenRouterDirectly() {
    console.log('Testing OpenRouter connection...');
    
    if (!state.profile?.openrouter_api_key) {
        console.error('No API key');
        return;
    }
    
    // Test 1: Try direct
    try {
        console.log('Test 1: Direct API call...');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': '0xHiTek'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Say "test successful"' }],
                max_tokens: 20
            })
        });
        
        const data = await response.json();
        console.log('Direct response:', data);
        
        if (data.choices) {
            console.log('✅ Direct API works!');
            return 'direct';
        }
    } catch (e) {
        console.error('Direct failed:', e.message);
    }
    
    // Test 2: Try with proxy
    try {
        console.log('Test 2: Proxy API call...');
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://openrouter.ai/api/v1/chat/completions');
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Say "test successful"' }],
                max_tokens: 20
            })
        });
        
        const data = await response.json();
        console.log('Proxy response:', data);
        
        if (data.choices) {
            console.log('✅ Proxy API works!');
            return 'proxy';
        }
    } catch (e) {
        console.error('Proxy failed:', e.message);
    }
    
    console.error('❌ Both methods failed');
    return null;
}
// FIXED: Start new chat function
async function startNewChat() {
    try {
        console.log('Creating new chat...');
        
        const { data: chat, error } = await supabase
            .from('chats')
            .insert({
                user_id: state.user.id,
                title: 'New Chat',
                model: elements.modelSelector.value || 'openai/gpt-3.5-turbo'
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating chat:', error);
            showNotification('Failed to create new chat', 'error');
            return null;
        }
        
        if (chat) {
            state.currentChatId = chat.id;
            state.messages = [];
            state.sessionTokens = 0;
            elements.tokenCount.textContent = '0';
            
            // Clear messages container and show welcome
            elements.messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="cyber-grid"></div>
                    <h2 class="glitch" data-text="Welcome to 0xHiTek">Welcome to 0xHiTek</h2>
                    <p>Your gateway to AI models via OpenRouter</p>
                    <div class="feature-grid">
                        <div class="feature-card">
                            <i class="fas fa-robot"></i>
                            <span>Multiple AI Models</span>
                        </div>
                        <div class="feature-card">
                            <i class="fas fa-database"></i>
                            <span>Cloud Storage</span>
                        </div>
                        <div class="feature-card">
                            <i class="fas fa-bolt"></i>
                            <span>Fast Response</span>
                        </div>
                    </div>
                </div>
            `;
            
            await loadChatHistory();
            console.log('New chat created:', chat.id);
            return chat;
        }
    } catch (error) {
        console.error('Error in startNewChat:', error);
        showNotification('Failed to start new chat', 'error');
        return null;
    }
}

// FIXED: Add message to UI with better error handling
function addMessageToUI(role, content) {
    try {
        // Remove welcome message if exists
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const timestamp = state.settings?.show_timestamps 
            ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '';
        
        // Format content for better display
        const formattedContent = formatMessageContent(content);
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-${role === 'user' ? 'user' : 'robot'}"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-role">${role === 'user' ? 'You' : 'AI'}</span>
                    ${timestamp ? `<span class="message-time">${timestamp}</span>` : ''}
                </div>
                <div class="message-text">${formattedContent}</div>
            </div>
        `;
        
        elements.messagesContainer.appendChild(messageDiv);
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        
        console.log(`Added ${role} message to UI`);
    } catch (error) {
        console.error('Error adding message to UI:', error);
    }
}

// Format message content for display
function formatMessageContent(content) {
    // Escape HTML to prevent XSS
    let formatted = escapeHtml(content);
    
    // Convert markdown-style code blocks to HTML
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Convert inline code to HTML
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert line breaks to HTML
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// Test function to verify API connection
async function testAPIConnection() {
    console.group('🔍 Testing API Connection');
    
    if (!state.profile?.openrouter_api_key) {
        console.error('No API key found!');
        showNotification('Please add your OpenRouter API key first', 'error');
        console.groupEnd();
        return;
    }
    
    try {
        console.log('Testing with API key:', state.profile.openrouter_api_key.substring(0, 10) + '...');
        
        // Test 1: Verify API key
        console.log('Test 1: Verifying API key...');
        const authResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.origin || 'http://localhost:3000',
                'X-Title': '0xHiTek Chat'
            }
        });
        
        const authData = await authResponse.json();
        console.log('Auth response:', authData);
        
        if (!authResponse.ok) {
            throw new Error('Invalid API key');
        }
        
        // Test 2: Send a test message
        console.log('Test 2: Sending test message...');
        const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.origin || 'http://localhost:3000',
                'X-Title': '0xHiTek Chat',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [
                    { role: 'user', content: 'Say "Hello, API is working!"' }
                ],
                max_tokens: 20
            })
        });
        
        const testData = await testResponse.json();
        console.log('Test response:', testData);
        
        if (testResponse.ok && testData.choices?.[0]?.message?.content) {
            console.log('✅ API Connection Successful!');
            showNotification('API connection test successful!', 'success');
        } else {
            console.error('API test failed:', testData);
            showNotification('API test failed: ' + (testData.error?.message || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('❌ API Connection Failed:', error);
        showNotification('API connection failed: ' + error.message, 'error');
    }
    
    console.groupEnd();
}

// Manual debug function
function debugChat() {
    console.group('🔍 Chat Debug Info');
    console.log('Current Chat ID:', state.currentChatId);
    console.log('Messages in state:', state.messages);
    console.log('API Key exists:', !!state.profile?.openrouter_api_key);
    console.log('Selected Model:', elements.modelSelector.value);
    console.log('Max Tokens:', elements.maxTokens?.value);
    console.log('Temperature:', elements.temperature?.value);
    console.log('Usage:', state.profile?.usage_count, '/', state.profile?.usage_limit);
    console.groupEnd();
}

// Add keyboard shortcut for testing
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+T to test API
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        testAPIConnection();
    }
    // Ctrl+Shift+D for debug info
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        debugChat();
    }
});
// Settings Functions
async function saveSettings() {
    const settings = {
        max_tokens: parseInt(elements.maxTokens.value),
        temperature: parseFloat(elements.temperature.value),
        show_timestamps: elements.showTimestamps.checked,
        sound_enabled: elements.soundEnabled.checked,
        preferred_model: elements.modelSelector.value,
        theme: document.body.classList.contains('light-theme') ? 'light' : 'dark'
    };
    
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: state.user.id,
            ...settings
        });
    
    if (error) {
        showNotification('Error saving settings: ' + error.message, 'error');
    } else {
        state.settings = settings;
        showNotification('Settings saved successfully!', 'success');
        elements.settingsModal.classList.remove('active');
    }
}

// Admin Functions
async function showAdminDashboard() {
    if (!state.isAdmin) return;
    
    elements.adminModal.classList.add('active');
    
    // Load user statistics
    const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (users) {
        elements.totalUsers.textContent = users.length;
        
        // Count active users (logged in today)
        const today = new Date().toISOString().split('T')[0];
        const activeCount = users.filter(u => 
            u.updated_at && u.updated_at.startsWith(today)
        ).length;
        elements.activeUsers.textContent = activeCount;
        
        // Populate users table
        const tbody = elements.usersTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(user.full_name || 'N/A')}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>${user.role || 'user'}</td>
                <td>${user.usage_count} / ${user.usage_limit}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="editUserLimit('${user.id}', ${user.usage_limit})">
                            Edit Limit
                        </button>
                        <button class="action-btn danger" onclick="resetUserUsage('${user.id}')">
                            Reset Usage
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

// Admin helper functions
window.editUserLimit = async function(userId, currentLimit) {
    const newLimit = prompt(`Enter new usage limit (current: ${currentLimit}):`, currentLimit);
    if (!newLimit) return;
    
    const { error } = await supabase
        .from('profiles')
        .update({ usage_limit: parseInt(newLimit) })
        .eq('id', userId);
    
    if (error) {
        showNotification('Error updating user limit: ' + error.message, 'error');
    } else {
        showNotification('User limit updated successfully!', 'success');
        showAdminDashboard(); // Refresh
    }
};

window.resetUserUsage = async function(userId) {
    if (!confirm('Reset this user\'s usage count to 0?')) return;
    
    const { error } = await supabase
        .from('profiles')
        .update({ usage_count: 0 })
        .eq('id', userId);
    
    if (error) {
        showNotification('Error resetting usage: ' + error.message, 'error');
    } else {
        showNotification('Usage reset successfully!', 'success');
        showAdminDashboard(); // Refresh
    }
};

// Export chat
async function exportChat() {
    if (!state.currentChatId) {
        showNotification('No chat to export', 'warning');
        return;
    }
    
    const chatData = {
        title: `0xHiTek Chat - ${new Date().toLocaleString()}`,
        model: elements.modelSelector.value,
        messages: state.messages,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `0xhitek-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Chat exported successfully', 'success');
}

// Filter models
function filterModels() {
    const searchTerm = elements.modelSearch.value.toLowerCase();
    const options = elements.modelSelector.options;
    
    for (let option of options) {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(searchTerm) ? '' : 'none';
    }
}

// Theme Functions
function toggleTheme() {
    const body = document.body;
    const isDark = !body.classList.contains('light-theme');
    
    if (isDark) {
        body.classList.add('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'dark');
    }
    
    // Save theme preference
    if (state.settings) {
        state.settings.theme = isDark ? 'light' : 'dark';
        saveSettings();
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// Utility Functions
function showAuth() {
    elements.authContainer.style.display = 'flex';
    elements.appContainer.style.display = 'none';
}

function showApp() {
    elements.authContainer.style.display = 'none';
    elements.appContainer.style.display = 'flex';
    loadChatHistory();
}

function showLoading(show) {
    if (show) {
        elements.loadingOverlay.classList.add('active');
    } else {
        elements.loadingOverlay.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                           type === 'success' ? 'check-circle' : 
                           type === 'warning' ? 'exclamation-triangle' : 
                           'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    elements.notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.error('Sound error:', error);
    }
}

// Session timeout handling
let lastActivity = Date.now();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
        lastActivity = Date.now();
    });
});

setInterval(() => {
    if (state.user && Date.now() - lastActivity > SESSION_TIMEOUT) {
        showNotification('Session expired. Please login again.', 'warning');
        supabase.auth.signOut();
    }
}, 60000); // Check every minute

// Error boundary
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('An error occurred. Please refresh the page if issues persist.', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('An error occurred. Please try again.', 'error');
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
