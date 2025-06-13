# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a modular MCP (Model Context Protocol) server that connects Claude with Microsoft Outlook through the Microsoft Graph API. The server is organized into feature-based modules:

- **auth/**: OAuth 2.0 authentication with token management and refresh
- **email/**: Email operations (list, search, read, send) 
- **calendar/**: Calendar event management (list, create, delete, accept/decline)
- **folder/**: Email folder operations
- **rules/**: Email rule management
- **utils/**: Shared utilities including Graph API client and OData helpers

The main entry point (`index.js`) aggregates all module tools and handles MCP protocol requests. Each module exports its tools array through an index file, following a consistent pattern.

## Key Components

- **config.js**: Centralized configuration including API endpoints, field selections, and auth settings
- **utils/graph-api.js**: Core Graph API client with proper OData filter encoding and test mode support
- **utils/odata-helpers.js**: Query building utilities for Microsoft Graph OData queries
- **auth/token-manager.js**: Handles token storage, refresh, and validation
- **outlook-auth-server.js**: Standalone OAuth callback server on port 3333

## Common Commands

### Development & Testing
```bash
# Start the MCP server
npm start

# Start server for specific user
USER_ID=user1 npm start

# Run in test mode (uses mock data)
npm run test-mode

# Run test mode for specific user
USER_ID=user1 npm run test-mode

# Test server with MCP Inspector
npm run inspect
# or
./test-modular-server.sh

# Start OAuth authentication server
npm run auth-server

# Start auth server for specific user
USER_ID=user1 npm run auth-server
```

### Configuration Setup
The server requires Azure App Registration with these permissions:
- offline_access, User.Read, Mail.Read, Mail.Send, Calendars.Read, Calendars.ReadWrite

Environment variables needed:
- `OUTLOOK_CLIENT_ID`: Azure app client ID
- `OUTLOOK_CLIENT_SECRET`: Azure app client secret  
- `USE_TEST_MODE`: "true" for mock responses
- `USER_ID`: User identifier for multi-user support (defaults to "default")

### Authentication Flow
1. Start auth server: `USER_ID=user1 npm run auth-server` (use same USER_ID as MCP server)
2. Use `authenticate` tool to get auth URL
3. Complete browser authentication 
4. Tokens stored in `~/.outlook-mcp-tokens-{USER_ID}.json`

### Multi-User Support
Each user's authentication tokens are stored separately using the USER_ID:
- Default user: `~/.outlook-mcp-tokens-default.json`
- User1: `~/.outlook-mcp-tokens-user1.json`
- User2: `~/.outlook-mcp-tokens-user2.json`

## Module Structure Pattern

Each module follows this structure:
```
module-name/
├── index.js          # Exports tools array
├── tool-name.js      # Individual tool handlers
└── ...
```

Tools are defined with: name, description, inputSchema, and handler function.

## Test Mode

Set `USE_TEST_MODE=true` to use mock data instead of real API calls. Mock responses are defined in `utils/mock-data.js`.