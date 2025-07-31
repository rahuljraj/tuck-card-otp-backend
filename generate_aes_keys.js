const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex'); // 64 hex chars
const iv = crypto.randomBytes(16).toString('hex');  // 32 hex chars

console.log('AES_SECRET_KEY:', key);
console.log('AES_IV:', iv);
