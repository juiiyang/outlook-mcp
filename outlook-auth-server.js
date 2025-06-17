#!/usr/bin/env node
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env file
require('dotenv').config();

// Log to console
console.log('Starting Outlook Authentication Server');

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-user-ids!!'; // 32 characters for AES-256
const ALGORITHM = 'aes-256-cbc';

// Encryption/Decryption functions
function decryptUserId(encryptedUserId) {
  try {
    const parts = encryptedUserId.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted user ID format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    // Ensure key is exactly 32 bytes for AES-256 using same method as encryption
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedText, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt user ID: ${error.message}`);
  }
}

function getUserTokenPath(userId) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  return path.join(homeDir, `.outlook-mcp-tokens-${userId}.json`);
}

// Authentication configuration
const AUTH_CONFIG = {
  clientId: process.env.MS_CLIENT_ID || '', // Set your client ID as an environment variable
  clientSecret: process.env.MS_CLIENT_SECRET || '', // Set your client secret as an environment variable
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3333/auth/callback',
  scopes: [
    'offline_access',
    'User.Read',
    'Mail.Read',
    'Mail.Send',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Contacts.Read'
  ]
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`Request received: ${pathname}`);
  console.log(`[DEBUG] Full URL: ${req.url}`);
  console.log(`[DEBUG] Parsed URL query:`, parsedUrl.query);
  
  if (pathname === '/auth/callback') {
    const query = parsedUrl.query;
    
    console.log(`[DEBUG] /auth/callback route - Full query object:`, query);
    console.log(`[DEBUG] /auth/callback route - state parameter:`, query.state);
    
    // Extract and decrypt user_id from state parameter
    let userId = null;
    if (query.state) {
      try {
        const stateData = JSON.parse(Buffer.from(query.state, 'base64').toString('utf8'));
        console.log(`[DEBUG] Decoded state data:`, stateData);
        
        if (stateData.user_id) {
          userId = decryptUserId(stateData.user_id);
          console.log(`Decrypted user ID: ${userId}`);
        } else {
          throw new Error('user_id not found in state data');
        }
      } catch (error) {
        console.error(`Failed to extract/decrypt user_id from state: ${error.message}`);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head>
              <title>Invalid State Parameter</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                h1 { color: #d9534f; }
                .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <h1>Invalid State Parameter</h1>
              <div class="error-box">
                <p>Failed to extract user_id from state parameter: ${error.message}</p>
              </div>
              <p>Please close this window and try again.</p>
            </body>
          </html>
        `);
        return;
      }
    } else {
      console.error('Missing state parameter in callback');
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Missing State Parameter</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #d9534f; }
              .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Missing State Parameter</h1>
            <div class="error-box">
              <p>The state parameter containing user_id is required for authentication.</p>
            </div>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
      return;
    }
    
    if (query.error) {
      console.error(`Authentication error: ${query.error} - ${query.error_description}`);
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Authentication Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #d9534f; }
              .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Authentication Error</h1>
            <div class="error-box">
              <p><strong>Error:</strong> ${query.error}</p>
              <p><strong>Description:</strong> ${query.error_description || 'No description provided'}</p>
            </div>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
      return;
    }
    
    if (query.code) {
      console.log('Authorization code received, exchanging for tokens...');
      
      // Exchange code for tokens
      exchangeCodeForTokens(query.code, userId)
        .then((tokens) => {
          console.log('Token exchange successful');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                  h1 { color: #5cb85c; }
                  .success-box { background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; }
                </style>
              </head>
              <body>
                <h1>Authentication Successful!</h1>
                <div class="success-box">
                  <p>You have successfully authenticated with Microsoft Graph API.</p>
                  <p>The access token has been saved securely.</p>
                </div>
                <p>You can now close this window and return to Claude.</p>
              </body>
            </html>
          `);
        })
        .catch((error) => {
          console.error(`Token exchange error: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Token Exchange Error</title>
                <style>
                  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                  h1 { color: #d9534f; }
                  .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
                </style>
              </head>
              <body>
                <h1>Token Exchange Error</h1>
                <div class="error-box">
                  <p>${error.message}</p>
                </div>
                <p>Please close this window and try again.</p>
              </body>
            </html>
          `);
        });
    } else {
      console.error('No authorization code provided');
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Missing Authorization Code</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #d9534f; }
              .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Missing Authorization Code</h1>
            <div class="error-box">
              <p>No authorization code was provided in the callback.</p>
            </div>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
    }
  } else if (pathname === '/auth') {
    // Handle the /auth route - redirect to Microsoft's OAuth authorization endpoint
    console.log('Auth request received, redirecting to Microsoft login...');
    
    // Verify credentials are set
    if (!AUTH_CONFIG.clientId || !AUTH_CONFIG.clientSecret) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Configuration Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #d9534f; }
              .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
              code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Configuration Error</h1>
            <div class="error-box">
              <p>Microsoft Graph API credentials are not set. Please set the following environment variables:</p>
              <ul>
                <li><code>MS_CLIENT_ID</code></li>
                <li><code>MS_CLIENT_SECRET</code></li>
              </ul>
            </div>
          </body>
        </html>
      `);
      return;
    }
    
    // Get parameters from query
    const query = parsedUrl.query;
    const clientId = query.client_id || AUTH_CONFIG.clientId;
    
    console.log(`[DEBUG] /auth route - Full query object:`, query);
    console.log(`[DEBUG] /auth route - user_id parameter:`, query.user_id);
    console.log(`[DEBUG] /auth route - client_id parameter:`, query.client_id);
    
    // Check for required user_id parameter
    if (!query.user_id) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Missing User ID</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #d9534f; }
              .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Missing User ID</h1>
            <div class="error-box">
              <p>The user_id parameter is required for authentication.</p>
              <p>Please use the format: <code>/auth?user_id=encrypted_user_id</code></p>
            </div>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
      return;
    }
    
    // Build the authorization URL with user_id preserved in state parameter
    const stateData = {
      timestamp: Date.now(),
      user_id: query.user_id
    };
    const stateString = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    const authParams = {
      client_id: clientId,
      response_type: 'code',
      redirect_uri: AUTH_CONFIG.redirectUri,
      scope: AUTH_CONFIG.scopes.join(' '),
      response_mode: 'query',
      state: stateString
    };
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${querystring.stringify(authParams)}`;
    console.log(`Redirecting to: ${authUrl}`);
    
    // Redirect to Microsoft's login page
    res.writeHead(302, { 'Location': authUrl });
    res.end();
  } else if (pathname === '/') {
    // Root path - provide instructions
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>Outlook Authentication Server</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #0078d4; }
            .info-box { background-color: #e7f6fd; border: 1px solid #b3e0ff; padding: 15px; border-radius: 4px; }
            code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Outlook Authentication Server</h1>
          <div class="info-box">
            <p>This server is running to handle Microsoft Graph API authentication callbacks.</p>
            <p>Don't navigate here directly. Instead, use the <code>authenticate</code> tool in Claude to start the authentication process.</p>
            <p>Make sure you've set the <code>MS_CLIENT_ID</code> and <code>MS_CLIENT_SECRET</code> environment variables.</p>
          </div>
          <p>Server is running at http://localhost:3333</p>
        </body>
      </html>
    `);
  } else {
    // Not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

function exchangeCodeForTokens(code, userId) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      client_id: AUTH_CONFIG.clientId,
      client_secret: AUTH_CONFIG.clientSecret,
      code: code,
      redirect_uri: AUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      scope: AUTH_CONFIG.scopes.join(' ')
    });
    
    const options = {
      hostname: 'login.microsoftonline.com',
      path: '/common/oauth2/v2.0/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const tokenResponse = JSON.parse(data);
            
            // Calculate expiration time (current time + expires_in seconds)
            const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            
            // Add expires_at for easier expiration checking
            tokenResponse.expires_at = expiresAt;
            
            // Save tokens to user-specific file
            const tokenStorePath = getUserTokenPath(userId);
            fs.writeFileSync(tokenStorePath, JSON.stringify(tokenResponse, null, 2), 'utf8');
            console.log(`Tokens saved to ${tokenStorePath}`);
            
            resolve(tokenResponse);
          } catch (error) {
            reject(new Error(`Error parsing token response: ${error.message}`));
          }
        } else {
          reject(new Error(`Token exchange failed with status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Start server
const PORT = 3333;
server.listen(PORT, () => {
  console.log(`Authentication server running at http://localhost:${PORT}`);
  console.log(`OAuth redirect URI: ${AUTH_CONFIG.redirectUri}`);
  console.log(`Tokens will be stored at: ~/.outlook-mcp-tokens-<user_id>.json`);
  
  if (!AUTH_CONFIG.clientId || !AUTH_CONFIG.clientSecret) {
    console.log('\n⚠️  WARNING: Microsoft Graph API credentials are not set.');
    console.log('   Please set the MS_CLIENT_ID and MS_CLIENT_SECRET environment variables.');
  }
  
  if (ENCRYPTION_KEY === 'default-32-char-key-for-user-ids!!') {
    console.log('\n⚠️  WARNING: Using default encryption key.');
    console.log('   Consider setting the ENCRYPTION_KEY environment variable for better security.');
  }
  
  if (AUTH_CONFIG.redirectUri !== 'http://localhost:3333/auth/callback') {
    console.log(`\n🔧 Using custom redirect URI: ${AUTH_CONFIG.redirectUri}`);
    console.log('   Make sure this URI is registered in your Azure AD app registration.');
  }
});

// Handle termination
process.on('SIGINT', () => {
  console.log('Authentication server shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Authentication server shutting down');
  process.exit(0);
});
