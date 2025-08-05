// Supabase Configuration
const SUPABASE_URL = 'https://hlinhshbhrmuvqrelroo.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaW5oc2hiaHJtdXZxcmVscm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0Mjc2NDgsImV4cCI6MjA3MDAwMzY0OH0.gKy6YyceJ4cE2OobRqLgwbhK2kzIJtUPPhTVPBSFjCk'; // Replace with your Supabase anon key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// OpenRouter Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Admin configuration - Replace with your email after first signup
const ADMIN_EMAIL = 'support@uylac.com'; // CHANGE THIS TO YOUR EMAIL

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
