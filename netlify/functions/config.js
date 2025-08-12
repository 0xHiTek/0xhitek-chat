// netlify/functions/config.js
// This sends PUBLIC configuration to your frontend
exports.handler = async (event, context) => {
  // Only send PUBLIC keys (anon key is designed to be public)
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Never send OPENROUTER_API_KEY or SERVICE_ROLE_KEY
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(config)
  };
};
