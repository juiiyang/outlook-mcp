# Modular Outlook MCP Server

This is a modular implementation of the Outlook MCP (Model Context Protocol) server that connects Claude with Microsoft Outlook through the Microsoft Graph API.

## Directory Structure

```
/modular/
├── index.js                 # Main entry point
├── config.js                # Configuration settings
├── auth/                    # Authentication modules
│   ├── index.js             # Authentication exports
│   ├── token-manager.js     # Token storage and refresh
│   └── tools.js             # Auth-related tools
├── calendar/                # Calendar functionality
│   ├── index.js             # Calendar exports
│   ├── list.js              # List events
│   ├── create.js            # Create event
│   ├── delete.js            # Delete event
│   ├── cancel.js            # Cancel
│   ├── accept.js            # Accept event
│   ├── tentative.js         # Tentatively accept event
│   ├── decline.js           # Decline event
├── email/                   # Email functionality
│   ├── index.js             # Email exports
│   ├── list.js              # List emails
│   ├── search.js            # Search emails
│   ├── read.js              # Read email
│   └── send.js              # Send email
└── utils/                   # Utility functions
    ├── graph-api.js         # Microsoft Graph API helper
    ├── odata-helpers.js     # OData query building
    └── mock-data.js         # Test mode data
```

## Features

- **Authentication**: OAuth 2.0 authentication with Microsoft Graph API
- **Email Management**: List, search, read, and send emails
- **Modular Structure**: Clean separation of concerns for better maintainability
- **OData Filter Handling**: Proper escaping and formatting of OData queries
- **Test Mode**: Simulated responses for testing without real API calls

## Azure App Registration & Configuration

To use this MCP server you need to first register and configure an app in Azure Portal. The following steps will take you through the process of registering a new app, configuring its permissions, and generating a client secret.

### App Registration

1. Open [Azure Portal](https://portal.azure.com/) in your browser
2. Sign in with a Microsoft Work or Personal account
3. Search for or cilck on "App registrations"
4. Click on "New registration"
5. Enter a name for the app, for example "Outlook MCP Server"
6. Select the "Accounts in any organizational directory and personal Microsoft accounts" option
7. In the "Redirect URI" section, select "Web" from the dropdown and enter "http://localhost:3333/auth/callback" in the textbox
8. Click on "Register"
9. From the Overview section of the app settings page, copy the "Application (client) ID" and enter it as the MS_CLIENT_ID in the .env file as well as the OUTLOOK_CLIENT_ID in the claude-config-sample.json file

### App Permissions

1. From the app settings page in Azure Portal select the "API permissions" option under the Manage section
2. Click on "Add a permission"
3. Click on "Microsoft Graph"
4. Select "Delegated permissions"
5. Search for the following permissions and slect the checkbox next to each one
    - offline_access
    - User.Read
    - Mail.Read
    - Mail.Send
    - Calendars.Read
    - Calendars.ReadWrite
    - Contacts.Read
6. Click on "Add permissions"

### Client Secret

1. From the app settings page in Azure Portal select the "Certificates & secrets" option under the Manage section
2. Switch to the "Client secrets" tab
3. Click on "New client secret"
4. Enter a description, for example "Client Secret"
5. Select the longest possible expiration time
6. Click on "Add"
7. Copy the secret value and enter it as the MS_CLIENT_SECRET in the .env file as well as the OUTLOOK_CLIENT_SECRET in the claude-config-sample.json file

## Configuration

To configure the server, edit the `config.js` file to change:

- Server name and version
- Test mode settings
- Authentication parameters
- Email field selections
- API endpoints

## Usage with Claude Desktop

1. Copy the sample configuration from `claude-config-sample.json` to your Claude Desktop configuration
2. Restart Claude Desktop
3. Authenticate with Microsoft using the `authenticate` tool
4. Use the email tools to manage your Outlook account

## Running Standalone

You can test the server using:

```bash
./test-modular-server.sh
```

This will use the MCP Inspector to directly connect to the server and let you test the available tools.

## Authentication Flow

1. Start a local authentication server on port 3333 (using `outlook-auth-server.js`)
2. Use the `authenticate` tool to get an authentication URL
3. Complete the authentication in your browser
4. Tokens are stored in `~/.outlook-mcp-tokens-{USER_ID}.json` (supports multi-user)

## Troubleshooting

- **Authentication Issues**: Check the token file and authentication server logs
- **OData Filter Errors**: Look for escape sequences in the server logs
- **API Call Failures**: Check for detailed error messages in the response

## Docker Deployment

### Available Docker Configurations

Three Dockerfile options are provided:

- **Dockerfile** - Dual server (both auth and MCP server together)
- **Dockerfile.auth-only** - Auth server only
- **Dockerfile.mcp-only** - MCP server only

### Option 1: Dual Server (Single Container)

Build and run both servers in one container:

```bash
# Build the image
docker build -t outlook-dual-server .

# Run the container
docker run -p 3333:3333 \
  -e MS_CLIENT_ID=your_azure_app_client_id \
  -e MS_CLIENT_SECRET=your_azure_app_client_secret \
  -e REDIRECT_URI=http://your-domain:3333/auth/callback \
  -e USER_ID=grey \
  -v ./tokens:/tokens \
  -i outlook-dual-server
```

Auth server logs are saved to `/tokens/auth-server.log`.

### Option 2: Separate Containers

Build separate images:

```bash
# Build both images
docker build -f Dockerfile.auth-only -t outlook-auth .
docker build -f Dockerfile.mcp-only -t outlook-mcp .

# Create shared volume for tokens
docker volume create outlook-tokens

# Run auth server
docker run -d -p 3333:3333 \
  -e MS_CLIENT_ID=your_azure_app_client_id \
  -e MS_CLIENT_SECRET=your_azure_app_client_secret \
  -e USER_ID=grey \
  -v outlook-tokens:/tokens \
  --name outlook-auth outlook-auth

# Run MCP server (for Claude Desktop integration)
docker run --rm \
  -e USER_ID=grey \
  -v outlook-tokens:/tokens \
  -i outlook-mcp
```

### Option 3: Docker Compose

Use Docker Compose for orchestrated deployment:

```bash
# Set environment variables
export MS_CLIENT_ID=your_azure_app_client_id
export MS_CLIENT_SECRET=your_azure_app_client_secret
export USER_ID=grey

# Run both services
docker-compose up
```

### Claude Desktop Integration with Docker

Since Claude Desktop requires direct stdin/stdout communication, use the provided wrapper script:

```json
{
  "mcpServers": {
    "outlook": {
      "command": "/path/to/outlook-mcp/docker-mcp-wrapper.sh",
      "env": {
        "USER_ID": "grey",
        "OUTLOOK_CLIENT_ID": "your_azure_client_id", 
        "OUTLOOK_CLIENT_SECRET": "your_azure_client_secret"
      }
    }
  }
}
```

Make sure to:
1. Build the MCP image: `docker build -f Dockerfile.mcp-only -t outlook-mcp .`
2. Create shared volume: `docker volume create outlook-tokens`
3. Run auth server separately for authentication

### Environment Variables for Docker

- `MS_CLIENT_ID` - Azure app client ID
- `MS_CLIENT_SECRET` - Azure app client secret  
- `REDIRECT_URI` - OAuth callback URL (change `your-domain` to your server's domain/IP)
- `USER_ID` - User identifier (optional, defaults to "default")

### Docker Features

- **Flexible Deployment**: Choose between single or multi-container setup
- **Persistent Tokens**: Token storage persisted via volume mount at `/tokens`
- **Multi-User**: Supports multiple users via `USER_ID` environment variable
- **Production Ready**: Optimized for deployment with minimal dependencies
- **Separate Logging**: Auth server logs isolated when using separate containers

### Authentication with Docker

1. Start the auth server container
2. Navigate to `http://your-domain:3333/auth?user_id=YOUR_USER_ID` 
3. Complete OAuth flow - tokens are saved to shared volume
4. MCP server automatically uses saved tokens for Graph API requests

## Extending the Server

To add more functionality:

1. Create new module directories (e.g., `calendar/`)
2. Implement tool handlers in separate files
3. Export tool definitions from module index files
4. Import and add tools to `TOOLS` array in `index.js`
