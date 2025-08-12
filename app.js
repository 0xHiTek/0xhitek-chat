// app.js - Main JavaScript for 0xHiTek Chat

// Global variables
let supabaseClient = null;
let currentUser = null;
let chatHistory = [];

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Initialize the application
async function initializeApp() {
    console.log('Initializing 0xHiTek Chat...');
    
    try {
        // Load configuration from backend
        await loadConfiguration();
        
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
