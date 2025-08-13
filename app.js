// app.js - Main JavaScript with Model Filtering

// Global variables
let supabaseClient = null;
let currentUser = null;
let chatHistory = [];
let availableModels = [];
let filteredModels = [];
let currentFilters = {
    search: '',
    provider: 'all',
    contextSize: 'all',
    capabilities: []
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Initialize the application
async function initializeApp() {
    console.log('Initializing 0xHiTek Chat...');
    
    try {
        // Load configuration from backend
        await loadConfiguration();
        
        // Load all available models from OpenRouter
        await loadModels();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up model filters
        setupModelFilters();
        
        // Check authentication status
        await checkAuth();
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize app. Please refresh the page.');
    }
}

// Load configuration from backend
async function loadConfiguration() {
    try {
        const response = await fetch('/.netlify/functions/get-config');
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }
        
        const config = await response.json();
        
        // Initialize Supabase if config is available
        if (config.supabaseUrl && config.supabaseAnonKey) {
            const { createClient } = window.supabase;
            supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
            console.log('Supabase initialized');
        } else {
            console.warn('Supabase configuration not available - running in limited mode');
        }
    } catch (error) {
        console.error('Configuration error:', error);
        // Continue without Supabase - allow direct chat access
    }
}

// Load all available models from OpenRouter
async function loadModels() {
    const modelSelect = document.getElementById('modelSelect');
    
    try {
        // Show loading state
        if (modelSelect) {
            modelSelect.innerHTML = '<option>Loading models...</option>';
            modelSelect.disabled = true;
        }
        
        // Fetch models from backend
        const response = await fetch('/.netlify/functions/get-models');
        if (!response.ok) {
            throw new Error('Failed to load models');
        }
        
        const models = await response.json();
        availableModels = models;
        filteredModels = models;
        
        // Display models
        displayModels(models);
        
        // Update model count
        updateModelCount(models.length, models.length);
        
        console.log(`Loaded ${models.length} models`);
        
    } catch (error) {
        console.error('Error loading models:', error);
        
        // Fallback to basic models
        const fallbackModels = [
            { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', display_name: 'GPT-3.5 Turbo (4k tokens)', context_length: 4096 },
            { id: 'openai/gpt-4', name: 'GPT-4', display_name: 'GPT-4 (8k tokens)', context_length: 8192 },
            { id: 'anthropic/claude-2', name: 'Claude 2', display_name: 'Claude 2 (100k tokens)', context_length: 100000 }
        ];
        
        availableModels = fallbackModels;
        filteredModels = fallbackModels;
        displayModels(fallbackModels);
    }
}

// Display models in the select dropdown
function displayModels(models) {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;
    
    if (models.length === 0) {
        modelSelect.innerHTML = '<option>No models found</option>';
        modelSelect.disabled = true;
        return;
    }
    
    // Group models by provider
    const modelsByProvider = {};
    models.forEach(model => {
        const provider = model.id.split('/')[0];
        if (!modelsByProvider[provider]) {
            modelsByProvider[provider] = [];
        }
        modelsByProvider[provider].push(model);
    });
    
    // Clear and rebuild select
    modelSelect.innerHTML = '';
    
    // Add models grouped by provider
    const providerNames = {
        'openai': '🤖 OpenAI',
        'anthropic': '🧠 Anthropic',
        'google': '🔍 Google',
        'meta-llama': '🦙 Meta Llama',
        'mistralai': '🌬️ Mistral AI',
        'cohere': '🔮 Cohere',
        'huggingface': '🤗 HuggingFace'
    };
    
    Object.keys(modelsByProvider).sort().forEach(provider => {
        const group = document.createElement('optgroup');
        group.label = providerNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
        
        modelsByProvider[provider].forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.display_name || model.name;
            
            // Add data attributes for filtering
            option.dataset.provider = provider;
            option.dataset.contextLength = model.context_length || 0;
            
            group.appendChild(option);
        });
        
        modelSelect.appendChild(group);
    });
    
    modelSelect.disabled = false;
}

// Set up model filters
function setupModelFilters() {
    // Search box
    const searchBox = document.getElementById('modelSearch');
    if (searchBox) {
        searchBox.addEventListener('input', debounce((e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        }, 300));
    }
    
    // Provider filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            e.target.classList.add('active');
            
            currentFilters.provider = e.target.dataset.filter;
            applyFilters();
        });
    });
    
    // Context size filter
    const contextFilter = document.getElementById('contextFilter');
    if (contextFilter) {
        contextFilter.addEventListener('change', (e) => {
            currentFilters.contextSize = e.target.value;
            applyFilters();
        });
    }
    
    // Capability checkboxes
    const capabilityCheckboxes = {
        coding: document.getElementById('filterCoding'),
        chat: document.getElementById('filterChat'),
        instruct: document.getElementById('filterInstruct')
    };
    
    Object.keys(capabilityCheckboxes).forEach(key => {
        if (capabilityCheckboxes[key]) {
            capabilityCheckboxes[key].addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!currentFilters.capabilities.includes(key)) {
                        currentFilters.capabilities.push(key);
                    }
                } else {
                    currentFilters.capabilities = currentFilters.capabilities.filter(c => c !== key);
                }
                applyFilters();
            });
        }
    });
}

// Apply filters to models
function applyFilters() {
    filteredModels = availableModels.filter(model => {
        // Search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            const modelName = (model.name || model.id).toLowerCase();
            const modelId = model.id.toLowerCase();
            if (!modelName.includes(searchTerm) && !modelId.includes(searchTerm)) {
                return false;
            }
        }
        
        // Provider filter
        if (currentFilters.provider !== 'all') {
            const provider = model.id.split('/')[0];
            
            if (currentFilters.provider === 'opensource') {
                // Open source models
                const openSourceProviders = ['meta-llama', 'mistralai', 'huggingface', 'teknium', 'nous'];
                if (!openSourceProviders.includes(provider)) {
                    return false;
                }
            } else if (currentFilters.provider === 'meta') {
                if (provider !== 'meta-llama') {
                    return false;
                }
            } else {
                if (provider !== currentFilters.provider) {
                    return false;
                }
            }
        }
        
        // Context size filter
        if (currentFilters.contextSize !== 'all') {
            const contextLength = model.context_length || 0;
            
            switch (currentFilters.contextSize) {
                case 'small':
                    if (contextLength >= 4096) return false;
                    break;
                case 'medium':
                    if (contextLength < 4096 || contextLength > 16384) return false;
                    break;
                case 'large':
                    if (contextLength < 16384 || contextLength > 100000) return false;
                    break;
                case 'xlarge':
                    if (contextLength <= 100000) return false;
                    break;
            }
        }
        
        // Capability filters
        if (currentFilters.capabilities.length > 0) {
            const modelIdLower = model.id.toLowerCase();
            const modelNameLower = (model.name || '').toLowerCase();
            
            for (const capability of currentFilters.capabilities) {
                switch (capability) {
                    case 'coding':
                        if (!modelIdLower.includes('code') && 
                            !modelNameLower.includes('code') &&
                            !modelIdLower.includes('codellama')) {
                            return false;
                        }
                        break;
                    case 'chat':
                        if (!modelIdLower.includes('chat') && 
                            !modelNameLower.includes('chat') &&
                            !modelIdLower.includes('turbo')) {
                            return false;
                        }
                        break;
                    case 'instruct':
                        if (!modelIdLower.includes('instruct') && 
                            !modelNameLower.includes('instruct')) {
                            return false;
                        }
                        break;
                }
            }
        }
        
        return true;
    });
    
    // Update display
    displayModels(filteredModels);
    updateModelCount(filteredModels.length, availableModels.length);
}

// Update model count display
function updateModelCount(filtered, total) {
    const modelCount = document.getElementById('modelCount');
    if (modelCount) {
        if (filtered === total) {
            modelCount.textContent = `${total} models available`;
        } else {
            modelCount.textContent = `Showing ${filtered} of ${total} models`;
        }
    }
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Set up event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Signup form
    const signupForm = document.getElementById('signupFormElement');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Chat form
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    
    // Model select - show model info
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            const selectedModel = availableModels.find(m => m.id === e.target.value);
            if (selectedModel) {
                showModelInfo(selectedModel);
            }
        });
    }
    
    // Settings sliders
    const tempSlider = document.getElementById('temperature');
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = e.target.value;
        });
    }
    
    const tokensSlider = document.getElementById('maxTokens');
    if (tokensSlider) {
        tokensSlider.addEventListener('input', (e) => {
            document.getElementById('tokensValue').textContent = e.target.value;
        });
    }
}

// Show model information
function showModelInfo(model) {
    const modelInfo = document.getElementById('modelInfo');
    if (!modelInfo) return;
    
    let infoHTML = '<div class="model-info-content">';
    
    // Provider
    const provider = model.id.split('/')[0];
    infoHTML += `<div class="model-info-item"><span class="model-info-label">Provider:</span> ${provider}</div>`;
    
    // Context length
    if (model.context_length) {
        infoHTML += `<div class="model-info-item"><span class="model-info-label">Context:</span> ${model.context_length.toLocaleString()} tokens</div>`;
    }
    
    // Pricing
    if (model.pricing) {
        if (model.pricing.prompt) {
            infoHTML += `<div class="model-info-item"><span class="model-info-label">Input:</span> ${model.pricing.prompt}/1K tokens</div>`;
        }
        if (model.pricing.completion) {
            infoHTML += `<div class="model-info-item"><span class="model-info-label">Output:</span> ${model.pricing.completion}/1K tokens</div>`;
        }
    }
    
    infoHTML += '</div>';
    
    modelInfo.innerHTML = infoHTML;
    modelInfo.classList.add('show');
}

// Check authentication status
async function checkAuth() {
    if (!supabaseClient) {
        // No Supabase - show chat directly
        showChatInterface();
        return;
    }
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentUser = session.user;
            showChatInterface();
            updateUserInfo();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showLogin();
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    if (!supabaseClient) {
        showError('Authentication system not available');
        showChatInterface(); // Show chat anyway
        return;
    }
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoading(true);
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        showChatInterface();
        updateUserInfo();
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();
    
    if (!supabaseClient) {
        showError('Authentication system not available');
        return;
    }
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    showLoading(true);
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        showError('Check your email to confirm your account!', 'success');
        showLogin();
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Handle OAuth login
async function loginWithGoogle() {
    if (!supabaseClient) {
        showError('OAuth not available');
        return;
    }
    
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google'
        });
        if (error) throw error;
    } catch (error) {
        showError(error.message);
    }
}

async function loginWithGitHub() {
    if (!supabaseClient) {
        showError('OAuth not available');
        return;
    }
    
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'github'
        });
        if (error) throw error;
    } catch (error) {
        showError(error.message);
    }
}

// Handle logout
async function logout() {
    if (!supabaseClient) {
        currentUser = null;
        showLogin();
        return;
    }
    
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        showLogin();
        chatHistory = [];
    } catch (error) {
        showError(error.message);
    }
}

// Handle chat submission
async function handleChatSubmit(e) {
    e.preventDefault();
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessage('user', message);
    
    // Clear input
    input.value = '';
    
    // Disable send button
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;
    
    try {
        // Get selected model and settings
        const model = document.getElementById('modelSelect').value;
        const temperature = parseFloat(document.getElementById('temperature').value);
        const maxTokens = parseInt(document.getElementById('maxTokens').value);
        
        // Show which model is being used
        const selectedModel = availableModels.find(m => m.id === model);
        console.log(`Sending to model: ${selectedModel?.name || model}`);
        
        // Send message to API
        const response = await sendChatMessage(message, model, temperature, maxTokens);
        
        // Add AI response to chat
        addMessage('assistant', response);
        
    } catch (error) {
        console.error('Chat error:', error);
        showError('Failed to send message. Please try again.');
    } finally {
        sendButton.disabled = false;
    }
}

// Send message to AI through backend
async function sendChatMessage(message, model, temperature, maxTokens) {
    const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [...chatHistory, { role: 'user', content: message }],
            model: model || 'openai/gpt-3.5-turbo',
            temperature: temperature || 0.7,
            max_tokens: maxTokens || 1000
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid response from API');
    }
    
    // Update chat history
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: data.choices[0].message.content });
    
    // Keep history limited to last 20 messages
    if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20);
    }
    
    return data.choices[0].message.content;
}

// Add message to chat display
function addMessage(role, content) {
    const messagesDiv = document.getElementById('chatMessages');
    
    // Remove welcome message if it exists
    const welcomeMsg = messagesDiv.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const roleDiv = document.createElement('div');
    roleDiv.className = 'message-role';
    roleDiv.textContent = role;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(roleDiv);
    messageDiv.appendChild(contentDiv);
    
    messagesDiv.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// UI Helper Functions
function showLogin() {
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'none';
}

function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'flex';
    document.getElementById('chatInterface').style.display = 'none';
}

function showChatInterface() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'block';
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email || 'Anonymous';
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showError(message, type = 'error') {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.background = type === 'success' ? '#00ff00' : '#ff0000';
    errorDiv.style.color = type === 'success' ? '#000' : '#fff';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Log app startup
console.log('0xHiTek Chat with Filters loaded - waiting for DOM...');
