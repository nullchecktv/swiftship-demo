# SwiftShip Logistics Platform

Multi-agent AI system for intelligent logistics operations and delivery exception handling. SwiftShip uses Amazon Bedrock and Momento Agent-to-Agent (A2A) orchestration to coordinate specialized agents that resolve delivery exceptions, process refunds, manage inventory, and handle order operations.

## Deployment

### Quick Deploy (Recommended)

Use the deployment script to automatically deploy the backend and configure the frontend:

**Using npm (easiest):**
```bash
# Linux/Mac/WSL/Git Bash (default)
npm run deploy

# Windows PowerShell
npm run deploy:windows
```

The script will interactively prompt you for a Momento API key (optional).

> **Windows Users:** If you have Git Bash or WSL installed, use `npm run deploy`. Otherwise, use `npm run deploy:windows` for PowerShell.

**Or run the scripts directly:**

**Linux/Mac/WSL (Bash):**
```bash
# Without Momento API key (limited functionality)
./deploy.sh

# With Momento API key (recommended for full A2A features)
./deploy.sh "your-momento-api-key"
```

**Windows (PowerShell):**
```powershell
# Without Momento API key (limited functionality)
.\deploy.ps1

# With Momento API key (recommended for full A2A features)
.\deploy.ps1 -MomentoApiKey "your-momento-api-key"
```

> **Note:** The Momento API key is optional but highly recommended. Without it, real-time agent event streaming and visualization will be limited. Get a free API key at [console.gomomento.com](https://console.gomomento.com).

The script will:
1. Build the SAM application
2. Deploy to AWS
3. Retrieve the API Gateway URL
4. Automatically update the `.env` file with the correct API endpoint

After deployment, simply run `npm run dev` to start the frontend.

> **Troubleshooting?** See [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting tips and advanced deployment options.

## Architecture

SwiftShip implements a multi-agent architecture where specialized agents collaborate to resolve delivery exceptions:

- **Triage Agent**: Orchestrates exception resolution by analyzing delivery failures and coordinating other agents
- **Order Agent**: Manages order lifecycle including status updates and order duplication for replacements
- **Payment Agent**: Processes refunds for delivery failures and customer requests
- **Warehouse Agent**: Handles inventory allocation for replacement orders

### Agent Collaboration

Agents communicate through Momento's A2A framework, enabling:
- Event-driven agent orchestration
- Real-time streaming of agent actions and decisions
- Asynchronous task coordination across multiple agents
- Transparent multi-agent workflows

## Features

- Intelligent delivery exception triage and resolution
- Multi-agent collaboration using Momento A2A
- Real-time event streaming for agent actions
- AWS Bedrock integration with Amazon Nova models
- Serverless architecture with AWS Lambda and API Gateway
- DynamoDB for order and delivery data storage
- React-based monitoring interface for driver and customer portals

## Prerequisites

- **Node.js 22+** and npm
- **AWS Account** with the following:
  - AWS CLI configured with appropriate credentials
  - Access to Amazon Bedrock (specifically Amazon Nova models)
  - Permissions to deploy Lambda functions, API Gateway, and DynamoDB tables
- **AWS SAM CLI** for deployment
- **Momento Account** (optional, but recommended):
  - Required for real-time agent event streaming and A2A orchestration
  - Get a free API key at [console.gomomento.com](https://console.gomomento.com)
  - Without Momento: Agents will still function but real-time event visualization will be limited

## Setup

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd api
npm install
cd ..
```

### 2. Get Momento API Key (Optional but Recommended)

For full A2A orchestration and real-time event streaming:

1. Visit [console.gomomento.com](https://console.gomomento.com)
2. Sign up for a free account
3. Create a cache named `mcp` (or your preferred name)
4. Generate an API key with read/write permissions
5. Use this key during deployment

> **Without Momento:** The application will still work, but you won't see real-time agent collaboration events in the UI.

## Manual Deployment

Use the deployment script to automatically deploy the backend and configure the frontend:

**Using npm (easiest):**
```bash
# Linux/Mac/WSL/Git Bash (default)
npm run deploy

# Windows PowerShell
npm run deploy:windows
```

The script will interactively prompt you for a Momento API key (optional).

> **Windows Users:** If you have Git Bash or WSL installed, use `npm run deploy`. Otherwise, use `npm run deploy:windows` for PowerShell.

**Or run the scripts directly:**

**Linux/Mac/WSL (Bash):**
```bash
# Without Momento API key (limited functionality)
./deploy.sh

# With Momento API key (recommended for full A2A features)
./deploy.sh "your-momento-api-key"
```

**Windows (PowerShell):**
```powershell
# Without Momento API key (limited functionality)
.\deploy.ps1

# With Momento API key (recommended for full A2A features)
.\deploy.ps1 -MomentoApiKey "your-momento-api-key"
```

> **Note:** The Momento API key is optional but highly recommended. Without it, real-time agent event streaming and visualization will be limited. Get a free API key at [console.gomomento.com](https://console.gomomento.com).

The script will:
1. Build the SAM application
2. Deploy to AWS
3. Retrieve the API Gateway URL
4. Automatically update the `.env` file with the correct API endpoint

After deployment, simply run `npm run dev` to start the frontend.

> **Troubleshooting?** See [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting tips and advanced deployment options.

## Usage

After deployment:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the application:**
   - Open http://localhost:5173
   - Use the Driver Portal to submit delivery exceptions
   - Watch real-time agent collaboration in the sequence diagram

3. **Try the demo scenarios:**
   - **Simple Scenario**: Customer not home - Direct triage processing
   - **Complex Scenario**: Damaged package - Multi-agent orchestration with refunds and replacements

## Agent Architecture

### How Agents Work Together

1. **Exception Occurs**: A delivery exception is reported through the driver portal
2. **Triage Analysis**: The Triage Agent analyzes the exception and determines the resolution strategy
3. **Agent Orchestration**: Based on the strategy, the Triage Agent coordinates other agents:
   - For damaged packages: Payment Agent → Warehouse Agent → Order Agent
   - For delivery failures: Order Agent updates status
   - For high-value items: Special handling with priority processing
4. **Customer Communication**: The Triage Agent sends customer notifications via email
5. **Resolution Complete**: All agents report completion and the customer receives updates

### Event Flow

Agents emit events through Momento A2A that can be monitored in real-time:
- Agent invocations and completions
- Tool executions and results
- Decision points and reasoning
- Error conditions and retries

## Development

### Run Frontend Locally

```bash
npm run dev
```

Access the application at `http://localhost:5173`

### Test Backend Locally

```bash
cd api
sam local start-api
```

### Project Structure

```
├── api/                          # Backend serverless application
│   ├── functions/
│   │   ├── agents/              # Agent implementations
│   │   ├── tools/               # Agent tools
│   │   ├── delivery/            # Delivery management
│   │   └── utils/               # Shared utilities
│   ├── template.yaml            # SAM template
│   └── package.json
├── src/                         # Frontend React application
│   ├── pages/                   # Portal pages
│   ├── components/              # React components
│   └── services/                # API and Momento services
└── package.json
```

## License

This repository is provided for demonstration purposes. No license is specified.

