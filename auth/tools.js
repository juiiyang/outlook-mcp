/**
 * Authentication-related tools for the Outlook MCP server
 */
const config = require('../config');
const tokenManager = require('./token-manager');
const crypto = require('crypto');

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-user-ids!!'; // 32 characters for AES-256
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt user ID for secure transmission
 * @param {string} userId - The user ID to encrypt
 * @returns {string} - Encrypted user ID in format iv:encryptedData
 */
function encryptUserId(userId) {
  const iv = crypto.randomBytes(16);
  // Ensure key is exactly 32 bytes for AES-256
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(userId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * About tool handler
 * @returns {object} - MCP response
 */
async function handleAbout() {
  return {
    content: [{
      type: "text",
      text: `📧 MODULAR Outlook Assistant MCP Server v${config.SERVER_VERSION} 📧\n\nProvides access to Microsoft Outlook email, calendar, and contacts through Microsoft Graph API.\nImplemented with a modular architecture for improved maintainability.`
    }]
  };
}

/**
 * Authentication tool handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleAuthenticate(args) {
  const force = args && args.force === true;
  const userId = process.env.USER_ID;
  
  // Check if user_id is provided in environment variables
  if (!userId) {
    return {
      content: [{
        type: "text",
        text: 'Error: USER_ID environment variable is required for authentication. Please set the USER_ID environment variable to create user-specific credentials.\n\nExample: export USER_ID="your_user_id"'
      }]
    };
  }
  
  console.log(`[DEBUG] USER_ID from environment: ${userId}`);
  
  // For test mode, create a test token
  if (config.USE_TEST_MODE) {
    // Create a test token with a 1-hour expiry
    tokenManager.createTestTokens(userId);
    
    return {
      content: [{
        type: "text",
        text: `Successfully authenticated with Microsoft Graph API (test mode) for user: ${userId}`
      }]
    };
  }
  
  // Encrypt the user_id for secure transmission
  const encryptedUserId = encryptUserId(userId);
  console.log(`[DEBUG] Encrypted user_id: ${encryptedUserId}`);
  
  // For real authentication, generate an auth URL with encrypted user_id
  const authUrl = `${config.AUTH_CONFIG.authServerUrl}/auth?client_id=${config.AUTH_CONFIG.clientId}&user_id=${encodeURIComponent(encryptedUserId)}`;
  console.log(`[DEBUG] Generated auth URL: ${authUrl}`);
  
  return {
    content: [{
      type: "text",
      text: `Authentication required for user: ${userId}\n\nPlease visit the following URL to authenticate with Microsoft: ${authUrl}\n\nAfter authentication, your credentials will be saved securely with your user ID.`
    }]
  };
}

/**
 * Check authentication status tool handler
 * @returns {object} - MCP response
 */
async function handleCheckAuthStatus() {
  console.error('[CHECK-AUTH-STATUS] Starting authentication status check');
  
  const userId = process.env.USER_ID;
  console.error(`[CHECK-AUTH-STATUS] USER_ID from environment: ${userId}`);
  
  if (!userId) {
    console.error('[CHECK-AUTH-STATUS] No USER_ID environment variable set');
    return {
      content: [{ type: "text", text: "Not authenticated - USER_ID environment variable not set" }]
    };
  }
  
  const tokens = tokenManager.loadTokenCache(userId);
  
  console.error(`[CHECK-AUTH-STATUS] Tokens loaded: ${tokens ? 'YES' : 'NO'}`);
  
  if (!tokens || !tokens.access_token) {
    console.error('[CHECK-AUTH-STATUS] No valid access token found');
    return {
      content: [{ type: "text", text: "Not authenticated" }]
    };
  }
  
  console.error('[CHECK-AUTH-STATUS] Access token present');
  console.error(`[CHECK-AUTH-STATUS] Token expires at: ${tokens.expires_at}`);
  console.error(`[CHECK-AUTH-STATUS] Current time: ${Date.now()}`);
  
  return {
    content: [{ type: "text", text: "Authenticated and ready" }]
  };
}

// Tool definitions
const authTools = [
  {
    name: "about",
    description: "Returns information about this Outlook Assistant server",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: handleAbout
  },
  {
    name: "authenticate",
    description: "Authenticate with Microsoft Graph API to access Outlook data (USER_ID environment variable required)",
    inputSchema: {
      type: "object",
      properties: {
        force: {
          type: "boolean",
          description: "Force re-authentication even if already authenticated"
        }
      },
      required: []
    },
    handler: handleAuthenticate
  },
  {
    name: "check-auth-status",
    description: "Check the current authentication status with Microsoft Graph API",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: handleCheckAuthStatus
  }
];

module.exports = {
  authTools,
  handleAbout,
  handleAuthenticate,
  handleCheckAuthStatus
};
