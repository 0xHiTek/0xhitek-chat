const fs = require('fs');

// Read the HTML file
let html = fs.readFileSync('index.html', 'utf8');

// Replace the empty ENV values with actual values
html = html.replace(
    "SUPABASE_URL: '', // Will be set from Netlify environment",
    `SUPABASE_URL: '${process.env.SUPABASE_URL}',`
);

html = html.replace(
    "SUPABASE_ANON_KEY: '', // Will be set from Netlify environment",
    `SUPABASE_ANON_KEY: '${process.env.SUPABASE_ANON_KEY}',`
);

html = html.replace(
    "OPENROUTER_API_KEY: '', // Will be set from Netlify environment",
    `OPENROUTER_API_KEY: '${process.env.OPENROUTER_API_KEY}',`
);

// Write the modified HTML
fs.writeFileSync('index.html', html);
console.log('Environment variables injected successfully!');
