const config = require('./config');
const path = require('path');

console.error('SERVER_NAME:', config.SERVER_NAME);
console.error('USER_ID:', config.USER_ID);
console.error('HOME env:', process.env.HOME);
console.error('USERPROFILE env:', process.env.USERPROFILE);
console.error('tokenStorePath (multi-user):', config.AUTH_CONFIG.tokenStorePath); 