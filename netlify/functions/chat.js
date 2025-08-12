// netlify/functions/chat.js
// Handles OpenRouter API calls

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get API key from environment variable
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        
        if (!OPENROUTER_API_KEY) {
            console.error('OpenRouter API key not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error. Please contact admin.' 
                })
            };
        }

        // Parse request body
        const requestBody = JSON.parse(event.body);
        
        console.log('Processing chat request for model:', requestBody.model);

        // Make request to OpenRouter
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://0xhitek.com',
                'X-Title': '0xHiTek Chat'
            },
            body: JSON.stringify({
                model: requestBody.model || 'openai/gpt-3.5-turbo',
                messages: requestBody.messages || [],
                temperature: requestBody.temperature || 0.7,
                max_tokens: requestBody.max_tokens || 1000,
                stream: false
            })
        });

        // Get response data
        const responseData = await openRouterResponse.json();

        // Check for API errors
        if (!openRouterResponse.ok) {
            console.error('OpenRouter API error:', responseData);
            return {
                statusCode: openRouterResponse.status,
                headers,
                body: JSON.stringify({ 
                    error: responseData.error?.message || 'API request failed' 
                })
            };
        }

        // Return successful response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error: ' + error.message 
            })
        };
    }
};
