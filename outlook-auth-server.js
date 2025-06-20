#!/usr/bin/env node
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Log to console
console.error('Starting Outlook Authentication Server');

// Authentication configuration
const AUTH_CONFIG = {
  clientId: process.env.MS_CLIENT_ID || '', // Set your client ID as an environment variable
  clientSecret: process.env.MS_CLIENT_SECRET || '', // Set your client secret as an environment variable
  redirectUri: 'http://localhost:3333/auth/callback',
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

// Helper function to get token store path for a user
function getTokenStorePath(userId = 'default') {
  return path.join(process.env.HOME || process.env.USERPROFILE, `.outlook-mcp-tokens-${userId}.json`);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.error(`Request received: ${pathname}`);
  
  if (pathname === '/auth/callback') {
    const query = parsedUrl.query;
    
    // Extract user_id from state parameter
    let userId = 'default';
    try {
      if (query.state) {
        const state = JSON.parse(query.state);
        userId = state.user_id || 'default';
      }
    } catch (error) {
      console.error('Error parsing state parameter:', error.message);
    }
    
    if (query.error) {
      console.error(`Authentication error for user ${userId}: ${query.error} - ${query.error_description}`);
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
      console.error(`Authorization code received for user ${userId}, exchanging for tokens...`);
      
      // Exchange code for tokens
      exchangeCodeForTokens(query.code, userId)
        .then((tokens) => {
          console.error(`Token exchange successful for user ${userId}`);
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
                  <p>The access token has been saved securely for user: <strong>${userId}</strong></p>
                </div>
                <p>You can now close this window and return to Claude.</p>
              </body>
            </html>
          `);
        })
        .catch((error) => {
          console.error(`Token exchange error for user ${userId}: ${error.message}`);
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
    const query = parsedUrl.query;
    const userId = query.user_id || 'default';
    
    console.error(`Auth request received for user: ${userId}, redirecting to Microsoft login...`);
    
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
    
    // Get client_id from query parameters or use the default
    const clientId = query.client_id || AUTH_CONFIG.clientId;
    
    // Build the authorization URL with user_id in state parameter
    const authParams = {
      client_id: clientId,
      response_type: 'code',
      redirect_uri: AUTH_CONFIG.redirectUri,
      scope: AUTH_CONFIG.scopes.join(' '),
      response_mode: 'query',
      state: JSON.stringify({ user_id: userId, timestamp: Date.now() })
    };
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${querystring.stringify(authParams)}`;
    console.error(`Redirecting to: ${authUrl}`);
    
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
            <p>To authenticate, navigate to: <code>/auth?user_id=YOUR_USER_ID</code></p>
            <p>For example: <code>http://localhost:3333/auth?user_id=user1</code></p>
            <p>If no user_id is provided, 'default' will be used.</p>
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

function exchangeCodeForTokens(code, userId = 'default') {
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
            
            // Save tokens to file using dynamic user ID
            const tokenStorePath = getTokenStorePath(userId);
            fs.writeFileSync(tokenStorePath, JSON.stringify(tokenResponse, null, 2), 'utf8');
            console.error(`Tokens saved for user ${userId} to ${tokenStorePath}`);
            
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
  console.error(`Authentication server running at http://localhost:${PORT}`);
  console.error(`Waiting for authentication callback at ${AUTH_CONFIG.redirectUri}`);
  console.error('To authenticate, navigate to: /auth?user_id=YOUR_USER_ID');
  console.error('Example: http://localhost:3333/auth?user_id=user1');
  
  if (!AUTH_CONFIG.clientId || !AUTH_CONFIG.clientSecret) {
    console.error('\n⚠️  WARNING: Microsoft Graph API credentials are not set.');
    console.error('   Please set the MS_CLIENT_ID and MS_CLIENT_SECRET environment variables.');
  }
});

// Handle termination
process.on('SIGINT', () => {
  console.error('Authentication server shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Authentication server shutting down');
  process.exit(0);
});
