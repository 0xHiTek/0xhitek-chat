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
async function loadAvailableModels() {
    if (!state.profile?.openrouter_api_key) {
        console.log('No API key found');
        useDefaultModels();
        return;
    }
    
    console.log('Loading models with API key...');
    
    try {
        // Test the API key first with a simple request
        const testResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': '0xHiTek Chat',
                'Content-Type': 'application/json'
            }
        });
        
        if (!testResponse.ok) {
            console.error('Invalid API key');
            showNotification('Invalid OpenRouter API key. Please check and try again.', 'error');
            useDefaultModels();
            return;
        }
        
        // Now fetch models
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': '0xHiTek Chat',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Models loaded:', data);
            
            // Filter and sort models
            state.availableModels = (data.data || [])
                .filter(model => model.id && model.name)
                .sort((a, b) => {
                    // Prioritize popular models
                    const priority = ['gpt-4', 'gpt-3.5', 'claude', 'gemini'];
                    const aPriority = priority.findIndex(p => a.id.toLowerCase().includes(p));
                    const bPriority = priority.findIndex(p => b.id.toLowerCase().includes(p));
                    
                    if (aPriority !== -1 && bPriority !== -1) {
                        return aPriority - bPriority;
                    }
                    if (aPriority !== -1) return -1;
                    if (bPriority !== -1) return 1;
                    
                    return a.name.localeCompare(b.name);
                });
            
            if (state.availableModels.length > 0) {
                populateModelSelector();
                showNotification(`Loaded ${state.availableModels.length} models`, 'success');
            } else {
                useDefaultModels();
            }
        } else {
            console.error('Failed to load models:', response.status);
            useDefaultModels();
        }
    } catch (error) {
        console.error('Error loading models:', error);
        showNotification('Could not load models. Using defaults.', 'warning');
        useDefaultModels();
    }
}

// Use default models as fallback
function useDefaultModels() {
    console.log('Using default models');
    state.availableModels = [
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'openai/gpt-4-turbo-preview', name: 'GPT-4 Turbo' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
        { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
        { id: 'google/gemini-pro', name: 'Gemini Pro' },
        { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B' },
        { id: 'mistralai/mistral-medium', name: 'Mistral Medium' }
    ];
    populateModelSelector();
}

// Populate Model Selector
function populateModelSelector() {
    console.log('Populating model selector with', state.availableModels.length, 'models');
    
    elements.modelSelector.innerHTML = '';
    
    if (state.availableModels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        elements.modelSelector.appendChild(option);
        return;
    }
    
    state.availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name || model.id;
        
        // Set selected model
        if (model.id === (state.settings?.preferred_model || APP_CONFIG.defaultModel)) {
            option.selected = true;
        }
        
        elements.modelSelector.appendChild(option);
    });
    
    // If no model was selected, select the first one
    if (!elements.modelSelector.value && state.availableModels.length > 0) {
        elements.modelSelector.value = state.availableModels[0].id;
    }
}

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
    
    // Send message
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
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

async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || !state.profile?.openrouter_api_key) {
        if (!state.profile?.openrouter_api_key) {
            showNotification('Please add your OpenRouter API key in Profile settings', 'warning');
        }
        return;
    }
    
    // Check usage limit
    if (state.profile.usage_count >= state.profile.usage_limit) {
        showNotification('You have reached your usage limit. Please contact admin.', 'error');
        return;
    }
    
    // Create new chat if needed
    if (!state.currentChatId) {
        await startNewChat();
    }
    
    // Disable input while processing
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    showLoading(true);
    
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
    const apiMessages = state.messages.map(m => ({
        role: m.role,
        content: m.content
    }));
    apiMessages.push({ role: 'user', content: message });
    
    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.profile.openrouter_api_key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': '0xHiTek Chat',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: elements.modelSelector.value || APP_CONFIG.defaultModel,
                messages: apiMessages,
                max_tokens: parseInt(elements.maxTokens.value),
                temperature: parseFloat(elements.temperature.value)
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;
        
        // Update token count
        const tokensUsed = data.usage?.total_tokens || 0;
        state.sessionTokens += tokensUsed;
        elements.tokenCount.textContent = state.sessionTokens;
        
        // Add assistant message to UI
        addMessageToUI('assistant', assistantMessage);
        
        // Save assistant message to database
        await supabase
            .from('messages')
            .insert({
                chat_id: state.currentChatId,
                user_id: state.user.id,
                role: 'assistant',
                content: assistantMessage,
                tokens: tokensUsed
            });
        
        // Update usage count
        const newUsageCount = state.profile.usage_count + tokensUsed;
        await supabase
            .from('profiles')
            .update({ 
                usage_count: newUsageCount 
            })
            .eq('id', state.user.id);
        
        state.profile.usage_count = newUsageCount;
        elements.usageCount.textContent = newUsageCount;
        
        // Log usage
        await supabase
            .from('usage_logs')
            .insert({
                user_id: state.user.id,
                tokens_used: tokensUsed,
                model: elements.modelSelector.value
            });
        
        // Update chat title if first message
        if (state.messages.length === 0) {
            const title = message.substring(0, 50);
            await supabase
                .from('chats')
                .update({ 
                    title,
                    model: elements.modelSelector.value
                })
                .eq('id', state.currentChatId);
            
            await loadChatHistory();
        }
        
        // Update state messages
        state.messages.push(
            { role: 'user', content: message },
            { role: 'assistant', content: assistantMessage, tokens: tokensUsed }
        );
        
        // Play sound if enabled
        if (state.settings?.sound_enabled) {
            playNotificationSound();
        }
        
        // Check usage warning
        const usagePercentage = (state.profile.usage_count / state.profile.usage_limit) * 100;
        if (usagePercentage >= 80 && usagePercentage < 90) {
            showNotification('You have used 80% of your usage limit', 'warning');
        } else if (usagePercentage >= 90) {
            showNotification('Warning: You have used 90% of your usage limit!', 'error');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error: ' + error.message, 'error');
    } finally {
        elements.sendBtn.disabled = false;
        showLoading(false);
        elements.messageInput.focus();
    }
}

function addMessageToUI(role, content) {
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
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-${role === 'user' ? 'user' : 'robot'}"></i>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-role">${role === 'user' ? 'You' : 'AI'}</span>
                ${timestamp ? `<span class="message-time">${timestamp}</span>` : ''}
            </div>
            <div class="message-text">${escapeHtml(content)}</div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

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
