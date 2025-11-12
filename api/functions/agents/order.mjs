import { createMomentoAgent } from 'momento-a2a-agent';
import { converse } from '../utils/agents.mjs';
import { changeOrderStatus } from '../tools/change-order-status.mjs';
import { duplicateOrder } from '../tools/duplicate-order.mjs';

let agent;

const getAgent = async (baseUrl) => {
  if (!agent) {
    const agentParams = {
      cacheName: 'mcp',
      apiKey: process.env.MOMENTO_API_KEY,
      agentCard: {
        name: 'Order Management Agent',
        description: 'Manage shipping orders, statuses, and order operations',
        url: baseUrl,
        capabilities: {
          streaming: false,
          pushNotifications: false
        }
      },
      skills: [
        {
          id: 'change-order-status',
          name: 'Change Order Status',
          description: 'Update order status for demo scenarios including delivery failures',
          examples: [
            'Change order ORD-12345 status to delivery_failed',
            'Update order status to in_transit',
            'Mark order as delivered'
          ],
          tags: ['order-management', 'status-update', 'delivery']
        },
        {
          id: 'duplicate-order',
          name: 'Duplicate Order',
          description: 'Create replacement orders for failed deliveries with optional customer and address overrides',
          examples: [
            'Duplicate order ORD-12345 for redelivery',
            'Create a replacement order with new address',
            'Duplicate order with updated customer information'
          ],
          tags: ['order-management', 'redelivery', 'replacement']
        }
      ],
      options: {
        defaultTtlSeconds: 3600,
        registerAgent: true
      },
      handler: agentHandler
    };

    agent = await createMomentoAgent(agentParams);
  }

  return agent;
}

export const handler = async (event) => {
  try {
    const { request, baseUrl } = lambdaEventToRequest(event);
    const agentInstance = await getAgent(baseUrl);
    const response = await agentInstance.fetch(request);

    const body = await response.text();
    const headers = Object.fromEntries(response.headers.entries());
    return {
      statusCode: response.status,
      headers,
      body,
    };
  } catch (error) {
    console.error('Order agent error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Something went wrong' }),
    };
  }
};

const lambdaEventToRequest = (event) => {
  const { rawPath, rawQueryString, headers, body, isBase64Encoded, requestContext } = event;
  const baseUrl = `https://${requestContext.domainName}`;
  const url = rawQueryString ? `${baseUrl}${rawPath}?${rawQueryString}` : `${baseUrl}${rawPath}`;
  const method = event.requestContext.http.method;

  let init = { method, headers };
  if (body) {
    init.body = isBase64Encoded ? Buffer.from(body, 'base64') : body;
  }

  return { request: new Request(url, init), baseUrl };
};

// Convert tools to Bedrock format
const convertToBedrockTools = (tools) => {
  return tools.map(tool => ({
    spec: {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        json: tool.schema
      }
    },
    handler: tool.handler,
    isMultiTenant: tool.isMultiTenant
  }));
};

const agentHandler = async (message) => {
  const systemPrompt = `You are an order management agent for SwiftShip demo system. You specialize in order status management and order duplication for delivery scenarios.

## Core Capabilities

You have access to two essential tools for demo scenarios:

### 1. changeOrderStatus - Simplified Order Status Management
**Purpose**: Update order status for demo scenarios including delivery failures
**Key Features**:
- Update order status including 'delivery_failed' for demo scenarios
- Simple validation and status tracking
- Emit A2A events for real-time monitoring in the demo UI

### 2. duplicateOrder - Simplified Order Duplication
**Purpose**: Create replacement orders for failed deliveries in demo scenarios
**Key Features**:
- Create duplicate orders with optional customer and address overrides
- Simple order copying for demo reliability
- Emit A2A events for real-time monitoring in the demo UI

## Demo Guidelines:
- Focus on quick, reliable order operations for demo scenarios
- Provide clear confirmation messages for all operations
- Handle errors gracefully with simple explanations
- Always include scenarioId when provided for A2A event tracking

This is a demonstration system - all order operations are simulated for demo purposes.`;

  const tools = convertToBedrockTools([changeOrderStatus, duplicateOrder]);

  // Extract tenantId from message context - this would need to be implemented based on how Momento passes context
  // For now, using a placeholder that would need to be properly implemented
  const context = {
    tenantId: 'demo-tenant', // This should be extracted from the actual request context
    sessionId: 'session-' + Date.now()
  };

  const response = await converse(process.env.MODEL_ID, systemPrompt, message, tools, context);
  return { message: response };
};
