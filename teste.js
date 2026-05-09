const { createCanvas } = require('canvas');
const { MessageMedia } = require('whatsapp-web.js');

const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 200, 200);
const buffer = canvas.toBuffer();
const media = new MessageMedia('image/png', buffer.toString('base64'));
console.log("Media criada com sucesso:", media.mimetype, media.data.length);