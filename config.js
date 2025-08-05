// Supabase Configuration
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase anon key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// OpenRouter Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Admin configuration - Replace with your email after first signup
const ADMIN_EMAIL = 'your-email@example.com'; // CHANGE THIS TO YOUR EMAIL

// App Configuration
const APP_CONFIG = {
    appName: '0xHiTek',
    defaultModel: 'openai/gpt-3.5-turbo',
    defaultMaxTokens: 2000,
    defaultTemperature: 0.7,
    defaultUsageLimit: 10000,
    maxFileSize: 5 * 1024 * 1024, // 5MB for avatar uploads
};

// Email Templates (for Supabase Auth emails - configure in Supabase dashboard)
const EMAIL_TEMPLATES = {
    welcomeSubject: 'Welcome to 0xHiTek!',
    resetSubject: 'Reset your 0xHiTek password',
    usageLimitSubject: 'Usage limit warning - 0xHiTek',
};
