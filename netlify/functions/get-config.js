// netlify/functions/get-config.js
// Provides PUBLIC configuration to frontend

exports.handler = async (event, context) => {
    // Only return PUBLIC configuration
    // Never include API keys or service keys here
    const config = {
        supabaseUrl: process.env.SUPABASE_URL || 
                     process.env.NEXT_PUBLIC_SUPABASE_URL || 
                     process.env.SUPABASE_DATABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 
                         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
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
