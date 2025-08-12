// ============================================
// app.js - Complete Application Logic
// 0xHiTek Chat Application
// ============================================

// ============================================
// Environment Configuration (Secure)
// ============================================
const ENV = {
    SUPABASE_URL: '', // Will be set from Netlify environment
    SUPABASE_ANON_KEY: '', // Will be set from Netlify environment
    OPENROUTER_API_KEY: '', // Will be set from Netlify environment
    ADMIN_EMAIL: 'admin@0xhitek.com'
};

// ============================================
// Initialize Supabase Client
// ============================================
let supabase = null;
// Global variables
let supabaseClient = null;
let currentUser = null;

// Initialize the app
async function initApp() {
  try {
    // First, get configuration from backend
    const configResponse = await fetch('/.netlify/functions/get-config');
    if (!configResponse.ok) {
      throw new Error('Failed to load configuration');
    }
    
    const config = await configResponse.json();
    
    // Initialize Supabase with the config
    if (config.supabaseUrl && config.supabaseAnonKey) {
      const { createClient } = window.supabase;
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
      console.log('Supabase initialized successfully');
    } else {
      console.error('Missing Supabase configuration');
      // Continue without Supabase for now
    }

    // Load AI models (use static list for now)
    loadModels();
    
    // Check if user is logged in
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        currentUser = session.user;
        showChatInterface();
      } else {
        showLoginForm();
      }
    } else {
      // If no Supabase, just show the chat interface
      showChatInterface();
    }
    
  } catch (error) {
    console.error('Initialization error:', error);
    // Show error to user
    showError('Failed to initialize app: ' + error.message);
  }
}

// Load models (static list for now)
function loadModels() {
  const models = [
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'openai/gpt-4', name: 'GPT-4' },
    { id: 'anthropic/claude-2', name: 'Claude 2' },
    { id: 'google/palm-2-chat-bison', name: 'PaLM 2' },
    { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B' }
  ];
  
  const modelSelect = document.getElementById('model-select') || 
                      document.querySelector('select[name="model"]') ||
                      document.querySelector('.model-select');
                      
  if (modelSelect) {
    modelSelect.innerHTML = models.map(model => 
      `<option value="${model.id}">${model.name}</option>`
    ).join('');
    console.log('Models loaded');
  } else {
    console.log('Model select element not found');
  }
}

// Send message to AI through your backend
async function sendChatMessage(message, model = 'openai/gpt-3.5-turbo') {
  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        model: model,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}

// Show error message
function showError(message) {
  console.error(message);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: red; color: white; padding: 10px; border-radius: 5px; z-index: 9999;';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// Show login form (implement based on your HTML)
function showLoginForm() {
  console.log('Showing login form');
  // Your login form code here
  document.querySelector('.login-form')?.classList.remove('hidden');
  document.querySelector('.chat-interface')?.classList.add('hidden');
}

// Show chat interface (implement based on your HTML)
function showChatInterface() {
  console.log('Showing chat interface');
  // Your chat interface code here
  document.querySelector('.login-form')?.classList.add('hidden');
  document.querySelector('.chat-interface')?.classList.remove('hidden');
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
// ============================================
// State Management
// ============================================
class AppState {
    constructor() {
        this.user = null;
        this.currentChatId = null;
        this.messages = [];
        this.chats = [];
        this.settings = {
            openrouterKey: '',
            maxTokens: 1000,
            temperature: 0.7,
            selectedModel: 'openai/gpt-3.5-turbo'
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
            elements.loginBtn.style.display = 'none';
            elements.signupBtn.style.display = 'none';
            elements.logoutBtn.style.display = 'block';
            elements.profileBtn.style.display = 'block';
            elements.userInfo.style.display = 'flex';
            elements.userEmail.textContent = this.user.email;
            elements.sendBtn.disabled = false;

            if (this.user.email === ENV.ADMIN_EMAIL || this.user.role === 'admin') {
                elements.adminBtn.style.display = 'block';
            }
        } else {
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
            if (this.user && !this.isProcessing && supabase) {
                try {
                    await supabase.from('profiles').select('id').eq('id', this.user.id).limit(1).single();
                    this.lastActivity = Date.now();
                } catch (error) {
                    console.log('Keep-alive ping');
                }
            }
        }, 20000); // 20 seconds
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

const appState = new AppState();

// ============================================
// Model Selector Class with Search
// ============================================
class ModelSelector {
    constructor() {
        this.models = [];
        this.filteredModels = [];
        this.selectedModel = 'openai/gpt-3.5-turbo';
        this.isLoaded = false;
        this.isDropdownOpen = false;
        
        this.searchInput = document.getElementById('modelSearch');
        this.searchClear = document.getElementById('modelSearchClear');
        this.dropdown = document.getElementById('modelDropdown');
    }

    init() {
        // Set initial value
        this.searchInput.value = this.getModelDisplayName(this.selectedModel);
        
        // Event listeners
        this.searchInput.addEventListener('focus', () => this.handleFocus());
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.searchInput.addEventListener('blur', (e) => this.handleBlur(e));
        this.searchClear.addEventListener('click', () => this.clearSearch());
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.model-search-wrapper')) {
                this.closeDropdown();
            }
        });
    }

    async handleFocus() {
        this.openDropdown();
        
        if (!this.isLoaded) {
            await this.loadModels();
        } else {
            this.renderModels(this.filteredModels.length > 0 ? this.filteredModels : this.models);
        }
        
        // Select all text for easy search
        this.searchInput.select();
    }

    handleBlur(e) {
        // Delay to allow click on dropdown items
        setTimeout(() => {
            if (!this.dropdown.contains(document.activeElement)) {
                // Restore selected model name if search is empty
                if (!this.searchInput.value) {
                    this.searchInput.value = this.getModelDisplayName(this.selectedModel);
                }
            }
        }, 200);
    }

    async loadModels() {
        this.dropdown.innerHTML = `
            <div class="model-loading">
                <div class="model-loading-spinner"></div>
                <p>Loading all models...</p>
            </div>
        `;

        try {
            // First try to load from OpenRouter API
            const models = await this.fetchModelsFromAPI();
            
            if (models.length === 0) {
                // Fallback to hardcoded comprehensive list
                this.models = this.getHardcodedModels();
            } else {
                this.models = models;
            }
            
            this.isLoaded = true;
            this.filteredModels = this.models;
            this.renderModels(this.models);
            
        } catch (error) {
            console.error('Error loading models:', error);
            // Use hardcoded list as fallback
            this.models = this.getHardcodedModels();
            this.isLoaded = true;
            this.filteredModels = this.models;
            this.renderModels(this.models);
        }
    }

            // src/services/api.js or wherever your API calls are
        export async function sendChatMessage(messages, settings = {}) {
          try {
            // Call YOUR Netlify function, not OpenRouter
            const response = await fetch('/.netlify/functions/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: messages,
                model: settings.model || 'openai/gpt-3.5-turbo',
                temperature: settings.temperature || 0.7,
                max_tokens: settings.maxTokens || 1000
              })
            });
        
            if (!response.ok) {
              throw new Error('Chat request failed');
            }
        
            return await response.json();
          } catch (error) {
            console.error('Chat error:', error);
            throw error;
          }
        }

    async fetchModelsFromAPI() {
        try {
            const apiKey = appState.settings.openrouterKey || ENV.OPENROUTER_API_KEY || '';
            
            if (!apiKey) {
                console.log('No API key available, using hardcoded models');
                return [];
            }

            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': '0xHiTek Chat'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch models');
            }

            const data = await response.json();
            
            // Process and format models
            return data.data.map(model => ({
                id: model.id,
                name: model.name || this.formatModelName(model.id),
                provider: model.id.split('/')[0],
                context: model.context_length || 'N/A',
                pricing: {
                    prompt: model.pricing?.prompt || 0,
                    completion: model.pricing?.completion || 0
                },
                description: model.description || ''
            })).sort((a, b) => {
                // Sort by provider, then by name
                if (a.provider !== b.provider) {
                    return a.provider.localeCompare(b.provider);
                }
                return a.name.localeCompare(b.name);
            });
            
        } catch (error) {
            console.error('API fetch error:', error);
            return [];
        }
    }

    getHardcodedModels() {
        // Comprehensive list of all OpenRouter models
        return [
            // OpenAI Models
            { id: 'openai/gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', provider: 'openai', context: '128000', pricing: { prompt: 0.01, completion: 0.03 } },
            { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', context: '128000', pricing: { prompt: 0.01, completion: 0.03 } },
            { id: 'openai/gpt-4', name: 'GPT-4', provider: 'openai', context: '8192', pricing: { prompt: 0.03, completion: 0.06 } },
            { id: 'openai/gpt-4-32k', name: 'GPT-4 32k', provider: 'openai', context: '32768', pricing: { prompt: 0.06, completion: 0.12 } },
            { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', context: '16385', pricing: { prompt: 0.0005, completion: 0.0015 } },
            { id: 'openai/gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16k', provider: 'openai', context: '16385', pricing: { prompt: 0.003, completion: 0.004 } },
            
            // Anthropic Claude Models
            { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', context: '200000', pricing: { prompt: 0.015, completion: 0.075 } },
            { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic', context: '200000', pricing: { prompt: 0.003, completion: 0.015 } },
            { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', context: '200000', pricing: { prompt: 0.00025, completion: 0.00125 } },
            { id: 'anthropic/claude-2.1', name: 'Claude 2.1', provider: 'anthropic', context: '200000', pricing: { prompt: 0.008, completion: 0.024 } },
            { id: 'anthropic/claude-2', name: 'Claude 2', provider: 'anthropic', context: '100000', pricing: { prompt: 0.008, completion: 0.024 } },
            { id: 'anthropic/claude-instant-v1', name: 'Claude Instant v1', provider: 'anthropic', context: '100000', pricing: { prompt: 0.0008, completion: 0.0024 } },
            
            // Google Models
            { id: 'google/gemini-pro', name: 'Gemini Pro', provider: 'google', context: '32760', pricing: { prompt: 0.000125, completion: 0.000375 } },
            { id: 'google/gemini-pro-vision', name: 'Gemini Pro Vision', provider: 'google', context: '32760', pricing: { prompt: 0.000125, completion: 0.000375 } },
            { id: 'google/palm-2-chat-bison', name: 'PaLM 2 Chat', provider: 'google', context: '8192', pricing: { prompt: 0.00025, completion: 0.0005 } },
            
            // Meta Llama Models
            { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'meta-llama', context: '8192', pricing: { prompt: 0.00059, completion: 0.00079 } },
            { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', provider: 'meta-llama', context: '8192', pricing: { prompt: 0.00006, completion: 0.00006 } },
            { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B', provider: 'meta-llama', context: '4096', pricing: { prompt: 0.0007, completion: 0.0009 } },
            { id: 'meta-llama/llama-2-13b-chat', name: 'Llama 2 13B', provider: 'meta-llama', context: '4096', pricing: { prompt: 0.00027, completion: 0.00027 } },
            
            // Mistral Models
            { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', provider: 'mistralai', context: '32768', pricing: { prompt: 0.00006, completion: 0.00006 } },
            { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', provider: 'mistralai', context: '32768', pricing: { prompt: 0.00024, completion: 0.00024 } },
            { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'mistralai', context: '65536', pricing: { prompt: 0.00108, completion: 0.00108 } },
            
            // Add more models as needed...
        ];
    }

    handleSearch(searchTerm) {
        if (searchTerm) {
            this.searchClear.style.display = 'block';
        } else {
            this.searchClear.style.display = 'none';
        }

        searchTerm = searchTerm.toLowerCase();
        
        if (searchTerm === '') {
            this.filteredModels = this.models;
        } else {
            this.filteredModels = this.models.filter(model => 
                model.name.toLowerCase().includes(searchTerm) ||
                model.id.toLowerCase().includes(searchTerm) ||
                model.provider.toLowerCase().includes(searchTerm)
            );
        }
        
        this.renderModels(this.filteredModels);
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchClear.style.display = 'none';
        this.filteredModels = this.models;
        this.renderModels(this.models);
        this.searchInput.focus();
    }

    renderModels(models) {
        if (models.length === 0) {
            this.dropdown.innerHTML = '<div class="no-models">No models found</div>';
            return;
        }

        // Group models by provider
        const grouped = {};
        models.forEach(model => {
            if (!grouped[model.provider]) {
                grouped[model.provider] = [];
            }
            grouped[model.provider].push(model);
        });

        let html = '';
        
        Object.keys(grouped).sort().forEach(provider => {
            html += `
                <div class="model-group">
                    <div class="model-group-header">${provider}</div>
            `;
            
            grouped[provider].forEach(model => {
                const isSelected = model.id === this.selectedModel;
                const priceClass = model.pricing.prompt === 0 ? 'free' : '';
                const price = model.pricing.prompt === 0 ? 'FREE' : `$${model.pricing.prompt}/1K`;
                
                html += `
                    <div class="model-item ${isSelected ? 'selected' : ''}" 
                         data-model-id="${model.id}"
                         onclick="modelSelector.selectModel('${model.id}')">
                        <span class="model-name">${model.name}</span>
                        <div class="model-info">
                            <span class="model-context">${this.formatContext(model.context)}</span>
                            <span class="model-price ${priceClass}">${price}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        });

        html += `
            <div class="model-stats">
                ${models.length} models available
            </div>
        `;

        this.dropdown.innerHTML = html;
    }

    selectModel(modelId) {
        this.selectedModel = modelId;
        appState.settings.selectedModel = modelId;
        this.searchInput.value = this.getModelDisplayName(modelId);
        this.closeDropdown();
        
        // Clear search
        this.searchClear.style.display = 'none';
        this.filteredModels = this.models;
        
        // Save to profile if logged in
        if (appState.user && supabase) {
            this.saveModelPreference();
        }
    }

    async saveModelPreference() {
        try {
            await supabase
                .from('profiles')
                .update({ 
                    settings: { 
                        ...appState.settings,
                        selectedModel: this.selectedModel 
                    } 
                })
                .eq('id', appState.user.id);
        } catch (error) {
            console.error('Error saving model preference:', error);
        }
    }

    getModelDisplayName(modelId) {
        const model = this.models.find(m => m.id === modelId);
        return model ? model.name : modelId.split('/')[1] || modelId;
    }

    formatModelName(modelId) {
        const parts = modelId.split('/');
        const name = parts[1] || modelId;
        return name.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatContext(context) {
        if (context === 'N/A') return context;
        const num = parseInt(context);
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}K`;
        }
        return context;
    }

    openDropdown() {
        this.dropdown.classList.add('active');
        this.isDropdownOpen = true;
    }

    closeDropdown() {
        this.dropdown.classList.remove('active');
        this.isDropdownOpen = false;
    }
}

let modelSelector;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize model selector
    modelSelector = new ModelSelector();
    modelSelector.init();

    // Wait for environment variables to be injected
    setTimeout(async () => {
        // Try to initialize Supabase
        if (typeof window.supabase !== 'undefined' && ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
            supabase = window.supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
            
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
                }
            });
        }

        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

        if (!supabase) {
            showToast('Please configure environment variables in Netlify', 'warning');
        }
    }, 1500);

    setupEventListeners();
});

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('signupBtn').addEventListener('click', () => openAuthModal('signup'));
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Profile & Admin
    document.getElementById('profileBtn').addEventListener('click', openProfileModal);
    document.getElementById('adminBtn').addEventListener('click', openAdminDashboard);
    const closeAdminBtn = document.getElementById('closeAdminBtn');
    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', closeAdminDashboard);
    }
    
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
    
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });
    
    // Auth form
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    document.getElementById('authToggleLink').addEventListener('click', toggleAuthMode);
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
    document.getElementById('closeProfileModal').addEventListener('click', closeProfileModal);
}

// ============================================
// Authentication Functions
// ============================================
async function handleAuthSubmit(e) {
    e.preventDefault();
    
    if (!supabase) {
        showToast('Database not configured', 'error');
        return;
    }
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const isLogin = document.getElementById('authTitle').textContent === 'LOGIN';
    
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
            
            showToast('Signup successful! Please check your email.', 'success');
            closeAuthModal();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleLogout() {
    if (!supabase) return;
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        appState.user = null;
        appState.currentChatId = null;
        appState.messages = [];
        appState.stopKeepAlive();
        
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
    if (!appState.user || !supabase) return;
    
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
                    openrouter_key: ENV.OPENROUTER_API_KEY || '',
                    role: appState.user.email === ENV.ADMIN_EMAIL ? 'admin' : 'user'
                })
                .select()
                .single();
            
            if (!createError) {
                data = newProfile;
            }
        }
        
        if (data) {
            if (data.openrouter_key) {
                appState.settings.openrouterKey = data.openrouter_key;
            }
            if (data.settings) {
                appState.settings = { ...appState.settings, ...data.settings };
                // Update model selector
                if (modelSelector && data.settings.selectedModel) {
                    modelSelector.selectedModel = data.settings.selectedModel;
                    modelSelector.searchInput.value = modelSelector.getModelDisplayName(data.settings.selectedModel);
                }
            }
            
            document.getElementById('profileName').value = data.full_name || '';
            document.getElementById('profileEmail').value = data.email;
            document.getElementById('openrouterKey').value = data.openrouter_key || '';
            document.getElementById('maxTokens').value = appState.settings.maxTokens;
            document.getElementById('temperature').value = appState.settings.temperature;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    
    if (!appState.user || !supabase) return;
    
    try {
        const profileData = {
            full_name: document.getElementById('profileName').value,
            openrouter_key: document.getElementById('openrouterKey').value,
            settings: {
                maxTokens: parseInt(document.getElementById('maxTokens').value),
                temperature: parseFloat(document.getElementById('temperature').value),
                selectedModel: modelSelector.selectedModel
            }
        };
        
        const { error } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', appState.user.id);
        
        if (error) throw error;
        
        appState.settings = { ...appState.settings, ...profileData.settings };
        appState.settings.openrouterKey = profileData.openrouter_key;
        
        showToast('Profile updated successfully', 'success');
        closeProfileModal();
    } catch (error) {
        showToast('Error updating profile', 'error');
    }
}

// ============================================
// Chat Management
// ============================================
async function createNewChat() {
    if (!appState.user || !supabase) {
        showToast('Please login to create a chat', 'warning');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('chats')
            .insert({
                user_id: appState.user.id,
                title: 'New Chat'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        appState.currentChatId = data.id;
        appState.messages = [];
        clearChatDisplay();
        await loadChatHistory();
    } catch (error) {
        showToast('Error creating chat', 'error');
    }
}

async function loadChat(chatId) {
    if (!appState.user || !supabase) return;
    
    try {
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
    if (!appState.user || !supabase) return;
    
    try {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', appState.user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
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
    
    // Check connection
    if (appState.isConnectionStale()) {
        await refreshConnection();
    }
    
    appState.isProcessing = true;
    appState.updateActivity();
    
    // Show processing message
    document.getElementById('processingMsg').style.display = 'block';
    
    try {
        if (!appState.currentChatId) {
            await createNewChat();
        }
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        displayMessage('user', message);
        
        // Save user message
        if (supabase) {
            const { data: userMessage } = await supabase
                .from('messages')
                .insert({
                    chat_id: appState.currentChatId,
                    user_id: appState.user.id,
                    role: 'user',
                    content: message,
                    model: modelSelector.selectedModel
                })
                .select()
                .single();
            
            if (userMessage) {
                appState.messages.push(userMessage);
            }
        }
        
        showTypingIndicator();
        
        // Get AI response
        const aiResponse = await getAIResponse(message);
        
        hideTypingIndicator();
        document.getElementById('processingMsg').style.display = 'none';
        
        if (aiResponse) {
            displayMessage('assistant', aiResponse);
            
            // Save AI response
            if (supabase) {
                const { data: assistantMessage } = await supabase
                    .from('messages')
                    .insert({
                        chat_id: appState.currentChatId,
                        user_id: appState.user.id,
                        role: 'assistant',
                        content: aiResponse,
                        model: modelSelector.selectedModel
                    })
                    .select()
                    .single();
                
                if (assistantMessage) {
                    appState.messages.push(assistantMessage);
                }
            }
            
            // Update chat title if first message
            if (appState.messages.length <= 2) {
                await updateChatTitle(message);
            }
        }
    } catch (error) {
        hideTypingIndicator();
        document.getElementById('processingMsg').style.display = 'none';
        showToast('Error: ' + error.message, 'error');
    } finally {
        appState.isProcessing = false;
    }
}

async function getAIResponse(message) {
    const apiKey = appState.settings.openrouterKey || ENV.OPENROUTER_API_KEY;
    
    if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Please add it in your profile settings.');
    }
    
    const messages = [
        ...appState.messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: message }
    ];
    
    // Check if on Netlify
    const isProduction = window.location.hostname.includes('netlify.app') || 
                       window.location.hostname.includes('0xhitek.com');
    
    const apiUrl = isProduction 
        ? '/.netlify/functions/openrouter-proxy'
        : 'https://openrouter.ai/api/v1/chat/completions';
    
    try {
        const requestBody = {
            model: modelSelector.selectedModel,
            messages: messages,
            maxTokens: appState.settings.maxTokens,
            temperature: appState.settings.temperature
        };
        
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
    if (!supabase) return;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            appState.user = session.user;
            appState.updateActivity();
        }
    } catch (error) {
        console.error('Error refreshing connection:', error);
    }
}

async function updateChatTitle(message) {
    if (!appState.currentChatId || !supabase) return;
    
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
// UI Functions
// ============================================
function displayMessage(role, content) {
    const container = document.getElementById('messagesContainer');
    
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
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    container.appendChild(messageDiv);
    
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
// Admin Functions
// ============================================
async function openAdminDashboard() {
    if (!appState.user || !supabase) return;
    
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', appState.user.id)
            .single();
        
        if (profile?.role !== 'admin' && appState.user.email !== ENV.ADMIN_EMAIL) {
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
        
        // Update stats
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
                        <button class="btn" onclick="toggleUserRole('${user.id}')">
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
    if (!supabase) return;
    
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
        await openAdminDashboard();
    } catch (error) {
        showToast('Error updating user role', 'error');
    }
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
    
    if (mode === 'login') {
        title.textContent = 'LOGIN';
        subtitle.textContent = 'Access the system';
        submitText.textContent = 'LOGIN';
        nameGroup.style.display = 'none';
        toggleText.innerHTML = "Don't have an account? <a href='#' id='authToggleLink' style='color: var(--primary);'>Sign up</a>";
    } else {
        title.textContent = 'SIGN UP';
        subtitle.textContent = 'Create your account';
        submitText.textContent = 'SIGN UP';
        nameGroup.style.display = 'block';
        toggleText.innerHTML = "Already have an account? <a href='#' id='authToggleLink' style='color: var(--primary);'>Login</a>";
    }
    
    modal.classList.add('active');
    document.getElementById('authToggleLink').addEventListener('click', toggleAuthMode);
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.getElementById('authForm').reset();
}

function toggleAuthMode(e) {
    e.preventDefault();
    const currentMode = document.getElementById('authTitle').textContent === 'LOGIN' ? 'signup' : 'login';
    openAuthModal(currentMode);
}

function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

// ============================================
// Utility Functions
// ============================================
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

// Make functions available globally
window.toggleUserRole = toggleUserRole;
window.loadChat = loadChat;
window.modelSelector = modelSelector;

// Local development environment variables (remove in production)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // For local testing only - add your keys here temporarily
    // ENV.SUPABASE_URL = 'your_url_here';
    // ENV.SUPABASE_ANON_KEY = 'your_key_here';
    // ENV.OPENROUTER_API_KEY = 'your_key_here';
}
