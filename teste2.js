const fs = require('fs');
console.log('Conteúdo do .env:', fs.readFileSync('.env', 'utf8'));
require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);