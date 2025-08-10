// src/services/api.js
// ✅ NEW SECURE CODE - No API keys here!

export async function sendChatMessage(messages, settings = {}) {
  try {
    // Call YOUR backend function, not OpenRouter directly
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
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}
