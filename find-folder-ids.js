#!/usr/bin/env node
/**
 * Script to find folder IDs for GitHub and Notifications folders
 * This helps create rules that target specific folders
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Configuration
const tokenPath = config.AUTH_CONFIG.tokenStorePath;

// Main function
async function findFolderIds() {
  try {
    // Read the authentication token from file (user-specific)
    console.error(`Reading token for user ${config.USER_ID} from ${tokenPath}`);
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      console.error('No access token found in token file!');
      process.exit(1);
    }
    
    console.error('Successfully read access token');
    
    // Step 1: Get the list of folders
    console.error('\nFetching top-level folders...');
    const folders = await callGraphAPI('me/mailFolders?$top=100');
    
    // Print all folders and their IDs for reference
    console.error('\nAll top-level folders:');
    folders.value.forEach(folder => {
      console.error(`${folder.displayName}: ${folder.id}`);
    });
    
    // Step 2: Find the GitHub folder specifically
    const githubFolder = folders.value.find(f => 
      f.displayName === 'GitHub' || f.displayName.toLowerCase() === 'github'
    );
    
    if (!githubFolder) {
      console.error('\nGitHub folder not found!');
      process.exit(1);
    }
    
    console.error(`\nFound GitHub folder: ${githubFolder.displayName}`);
    console.error(`ID: ${githubFolder.id}`);
    
    // Step 3: Get child folders of GitHub
    console.error('\nFetching GitHub child folders...');
    const childFolders = await callGraphAPI(`me/mailFolders/${githubFolder.id}/childFolders`);
    
    // Print all child folders
    console.error('\nChild folders of GitHub:');
    if (childFolders.value && childFolders.value.length > 0) {
      childFolders.value.forEach(folder => {
        console.error(`${folder.displayName}: ${folder.id}`);
      });
      
      // Step 4: Find the Notifications subfolder
      const notificationsFolder = childFolders.value.find(f => 
        f.displayName === 'Notifications' || f.displayName.toLowerCase() === 'notifications'
      );
      
      if (notificationsFolder) {
        console.error(`\nFound Notifications subfolder: ${notificationsFolder.displayName}`);
        console.error(`ID: ${notificationsFolder.id}`);
        
        // Final output for easy reference
        console.error('\n===== FOLDER IDs FOR RULES =====');
        console.error(`GitHub folder: ${githubFolder.id}`);
        console.error(`Notifications subfolder: ${notificationsFolder.id}`);
        console.error('===============================');
      } else {
        console.error('\nNotifications subfolder not found in GitHub folder');
      }
    } else {
      console.error('No child folders found in GitHub folder');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Helper function to call Microsoft Graph API
 */
async function callGraphAPI(endpoint) {
  return new Promise((resolve, reject) => {
    // Read token from file again to ensure it's fresh
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const accessToken = tokenData.access_token;
    
    const options = {
      hostname: 'graph.microsoft.com',
      path: `/v1.0/${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
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
            const jsonResponse = JSON.parse(data);
            resolve(jsonResponse);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
    
    req.end();
  });
}

// Run the script
findFolderIds();
