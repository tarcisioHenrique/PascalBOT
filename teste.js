require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
console.log('Arquivo .env foi lido?', Object.keys(process.env).some(k => k.includes('OPENAI')));