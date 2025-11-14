#!/bin/bash
# SwiftShip Deployment Script
# Deploys the backend and updates the frontend environment variable
#
# Usage:
#   ./deploy.sh                      # Deploy without Momento (limited A2A features)
#   ./deploy.sh "your-momento-key"   # Deploy with Momento (full features)
#
# Get a free Momento API key at: https://console.gomomento.com

set -e

MOMENTO_API_KEY="${1:-}"

echo "Starting SwiftShip deployment..."
echo ""

# Prompt for Momento API key if not provided
if [ -z "$MOMENTO_API_KEY" ]; then
    echo "Momento API Key Setup (Optional)"
    echo "================================"
    echo ""
    echo "Momento enables real-time A2A event streaming and agent visualization."
    echo "Without it, agents will still work but you won't see live updates in the UI."
    echo ""
    echo "Get a free API key at: https://console.gomomento.com"
    echo ""

    read -p "Do you have a Momento API key to add? (y/N): " response

    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        read -p "Enter your Momento API key: " MOMENTO_API_KEY
        if [ -z "$MOMENTO_API_KEY" ]; then
            echo "No key entered. Continuing without Momento..."
        else
            echo "Momento API key will be included in deployment."
        fi
    else
        echo "Continuing without Momento API key..."
    fi
    echo ""
fi

# Change to API directory
cd api

# Build and deploy the SAM application
echo ""
echo "Building SAM application..."
sam build

echo ""
echo "Deploying to AWS..."

if [ -n "$MOMENTO_API_KEY" ]; then
    sam deploy --parameter-overrides "MomentoApiKey=$MOMENTO_API_KEY"
else
    sam deploy
fi

# Get the API URL from CloudFormation outputs
echo ""
echo "Retrieving API endpoint..."
STACK_NAME="swiftship-demo"

API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='SwiftShipApi'].OutputValue" \
    --output text)

if [ -z "$API_URL" ]; then
    echo "ERROR: Could not retrieve SwiftShipApi output from CloudFormation"
    exit 1
fi

echo "API URL: $API_URL"

# Update the .env file
cd ..

echo ""
echo "Updating .env file..."

cat > .env << EOF
VITE_API_BASE_URL=$API_URL
EOF

if [ -n "$MOMENTO_API_KEY" ]; then
    echo "VITE_MOMENTO_API_KEY=$MOMENTO_API_KEY" >> .env
fi

echo "Updated .env with API URL"

echo ""
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' (if you haven't already)"
echo "  2. Run 'npm run dev' to start the frontend"
echo ""
echo "API Base URL: $API_URL"

if [ -z "$MOMENTO_API_KEY" ]; then
    echo ""
    echo "Note: Deployed without Momento API key"
    echo "Real-time A2A event streaming will be limited."
    echo "Get a free key at: https://console.gomomento.com"
fi
