const crypto = require('crypto');

// Generate a session secret
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log(sessionSecret);
