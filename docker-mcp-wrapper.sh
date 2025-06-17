#!/bin/bash

# Docker wrapper for MCP server
# This script runs the MCP server in Docker while maintaining stdin/stdout communication

docker run --rm \
  -v outlook-tokens:/tokens \
  -e USER_ID="${USER_ID:-grey}" \
  -e OUTLOOK_CLIENT_ID="${OUTLOOK_CLIENT_ID}" \
  -e OUTLOOK_CLIENT_SECRET="${OUTLOOK_CLIENT_SECRET}" \
  -i \
  outlook-mcp