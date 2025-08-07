exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { messages, model, maxTokens, temperature, apiKey } = JSON.parse(event.body);
    
    const openrouterKey = apiKey || process.env.OPENROUTER_API_KEY;

    if (!openrouterKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'API key is required' })
      };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://0xhitek.com',
        'X-Title': '0xHiTek Chat'
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-3.5-turbo',
        messages: messages,
        max_tokens: maxTokens || 1000,
        temperature: temperature || 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.error || 'API request failed' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
