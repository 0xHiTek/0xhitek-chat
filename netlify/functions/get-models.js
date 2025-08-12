// netlify/functions/get-models.js
// Fetches all available models from OpenRouter

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        
        if (!OPENROUTER_API_KEY) {
            console.error('OpenRouter API key not configured');
            // Return a default list if no API key
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify([
                    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
                    { id: 'openai/gpt-4', name: 'GPT-4' },
                    { id: 'anthropic/claude-2', name: 'Claude 2' }
                ])
            };
        }

        // Fetch models from OpenRouter
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://0xhitek.com',
                'X-Title': '0xHiTek Chat'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch models from OpenRouter');
            throw new Error('Failed to fetch models');
        }

        const data = await response.json();
        
        // Process and sort models
        const models = data.data
            .filter(model => {
                // Filter out models that are not suitable for chat
                return !model.id.includes('beta') && 
                       !model.id.includes('free') &&
                       model.context_length > 0;
            })
            .map(model => ({
                id: model.id,
                name: model.name || model.id,
                context_length: model.context_length,
                pricing: model.pricing,
                // Add a display name with context length
                display_name: `${model.name || model.id} (${model.context_length.toLocaleString()} tokens)`
            }))
            .sort((a, b) => {
                // Sort by provider and then by name
                const providerA = a.id.split('/')[0];
                const providerB = b.id.split('/')[0];
                
                // Priority order for providers
                const priority = {
                    'openai': 1,
                    'anthropic': 2,
                    'google': 3,
                    'meta-llama': 4,
                    'mistralai': 5
                };
                
                const priorityA = priority[providerA] || 999;
                const priorityB = priority[providerB] || 999;
                
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                
                return a.name.localeCompare(b.name);
            });

        console.log(`Returning ${models.length} models`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(models)
        };

    } catch (error) {
        console.error('Function error:', error);
        
        // Return a default list on error
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([
                { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', display_name: 'GPT-3.5 Turbo (4k tokens)' },
                { id: 'openai/gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16k', display_name: 'GPT-3.5 Turbo (16k tokens)' },
                { id: 'openai/gpt-4', name: 'GPT-4', display_name: 'GPT-4 (8k tokens)' },
                { id: 'openai/gpt-4-32k', name: 'GPT-4 32k', display_name: 'GPT-4 (32k tokens)' },
                { id: 'openai/gpt-4-turbo-preview', name: 'GPT-4 Turbo', display_name: 'GPT-4 Turbo (128k tokens)' },
                { id: 'anthropic/claude-2', name: 'Claude 2', display_name: 'Claude 2 (100k tokens)' },
                { id: 'anthropic/claude-2.1', name: 'Claude 2.1', display_name: 'Claude 2.1 (200k tokens)' },
                { id: 'anthropic/claude-instant-1', name: 'Claude Instant', display_name: 'Claude Instant (100k tokens)' },
                { id: 'google/palm-2-chat-bison', name: 'PaLM 2 Chat', display_name: 'PaLM 2 Chat (8k tokens)' },
                { id: 'google/palm-2-codechat-bison', name: 'PaLM 2 Code Chat', display_name: 'PaLM 2 Code Chat (8k tokens)' },
                { id: 'meta-llama/llama-2-13b-chat', name: 'Llama 2 13B', display_name: 'Llama 2 13B (4k tokens)' },
                { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B', display_name: 'Llama 2 70B (4k tokens)' },
                { id: 'meta-llama/codellama-34b-instruct', name: 'Code Llama 34B', display_name: 'Code Llama 34B (16k tokens)' },
                { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', display_name: 'Mistral 7B (8k tokens)' },
                { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', display_name: 'Mixtral 8x7B (32k tokens)' }
            ])
        };
    }
};
