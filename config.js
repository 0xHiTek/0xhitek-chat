// ============================================
// config.js - Configuration File
// ============================================

const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://hlinhshbhrmuvqrelroo.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaW5oc2hiaHJtdXZxcmVscm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0Mjc2NDgsImV4cCI6MjA3MDAwMzY0OH0.gKy6YyceJ4cE2OobRqLgwbhK2kzIJtUPPhTVPBSFjCk',
    
    // OpenRouter Configuration
    OPENROUTER_API_KEY: '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',
    OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    
    // Default Settings
    DEFAULT_MODEL: 'openai/gpt-3.5-turbo',
    DEFAULT_MAX_TOKENS: 1000,
    DEFAULT_TEMPERATURE: 0.7,
    
    // App Settings
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    KEEP_ALIVE_INTERVAL: 20000, // 20 seconds
    MESSAGE_HISTORY_LIMIT: 50,
    CHAT_HISTORY_LIMIT: 20,
    
    // Admin Email (make this user admin automatically)
    ADMIN_EMAIL: 'admin@0xhitek.com',
    
    // Available Models
    AVAILABLE_MODELS: [
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
        { id: 'openai/gpt-4', name: 'GPT-4', provider: 'OpenAI' },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
        { id: 'anthropic/claude-2', name: 'Claude 2', provider: 'Anthropic' },
        { id: 'anthropic/claude-instant-v1', name: 'Claude Instant', provider: 'Anthropic' },
        { id: 'google/palm-2-chat-bison', name: 'PaLM 2', provider: 'Google' },
        { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B', provider: 'Meta' },
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', provider: 'Mistral' }
    ]
};
