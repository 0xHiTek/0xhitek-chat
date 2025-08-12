// app.js - Main JavaScript for 0xHiTek Chat with dynamic model loading

// Global variables
let supabaseClient = null;
let currentUser = null;
let chatHistory = [];
let availableModels = [];

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
        
        if (modelSelect && models.length > 0) {
            // Group models by provider
            const modelsByProvider = {};
            models.forEach(model => {
                const provider = model.id.split('/')[0];
                if (!modelsByProvider[provider]) {
                    modelsByProvider[provider] = [];
                }
                modelsByProvider[provider].push(model);
            });
            
            // Create grouped options
            modelSelect.innerHTML = '';
            
            // Add popular models first
            const popularGroup = document.createElement('optgroup');
            popularGroup.label = '⭐ Popular Models';
            
            const popularModels = [
                'openai/gpt-3.5-turbo',
                'openai/gpt-4',
                'openai/gpt-4-turbo-preview',
                'anthropic/claude-2.1',
                'google/palm-2-chat-bison',
                'meta-llama/llama-2-70b-chat'
            ];
            
            popularModels.forEach(modelId => {
                const model = models.find(m => m.id === modelId);
                if (model) {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.display_name || model.name;
                    popularGroup.appendChild(option);
                }
            });
            
            if (popularGroup.children.length > 0) {
                modelSelect.appendChild(popularGroup);
            }
            
            // Add all models grouped by provider
            const providerNames = {
                'openai': 'OpenAI',
                'anthropic': 'Anthropic',
                'google': 'Google',
                'meta-llama': 'Meta Llama',
                'mistralai': 'Mistral AI',
                'cohere': 'Cohere',
                'huggingface': 'HuggingFace'
            };
            
            Object.keys(modelsByProvider).sort().forEach(provider => {
                const group = document.createElement('optgroup');
                group.label = providerNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
                
                modelsByProvider[provider].forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.display_name || model.name;
                    
                    // Add pricing info if available
                    if (model.pricing && model.pricing.prompt) {
                        option.title = `$${model.pricing.prompt} per 1K tokens`;
                    }
                    
                    group.appendChild(option);
                });
                
                modelSelect.appendChild(group);
            });
            
            modelSelect.disabled = false;
            console.log(`Loaded ${models.length} models`);
            
            // Update model count in UI if element exists
            const modelCount = document.getElementById('modelCount');
            if (modelCount) {
                modelCount.textContent = `${models.length} models available`;
            }
        }
        
    } catch (error) {
        console.error('Error loading models:', error);
        
        // Fallback to basic models
        if (modelSelect) {
            modelSelect.innerHTML = `
                <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="openai/gpt-4">GPT-4</option>
                <option value="anthropic/claude-2">Claude 2</option>
                <option value="google/palm-2-chat-bison">PaLM 2</option>
                <option value="meta-llama/llama-2-70b-chat">Llama 2 70B</option>
            `;
            modelSelect.disabled = false;
        }
    }
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
            if (selectedModel && selectedModel.context_length) {
                console.log(`Selected model: ${selectedModel.name} (Context: ${selectedModel.context_length} tokens)`);
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
    
    // Add refresh models button if it exists
    const refreshModelsBtn = document.getElementById('refreshModels');
    if (refreshModelsBtn) {
        refreshModelsBtn.addEventListener('click', loadModels);
    }
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
        console.log(`Sending to model: ${model}`);
        
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
console.log('0xHiTek Chat loaded - waiting for DOM...');
