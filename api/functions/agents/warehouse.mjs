import { createMomentoAgent } from 'momento-a2a-agent';
import { converse } from '../utils/agents.mjs';
import { allocateInventory } from '../tools/allocate-inventory.mjs';

let agent;

const getAgent = async (baseUrl) => {
  if (!agent) {
    const agentParams = {
      cacheName: 'mcp',
      apiKey: process.env.MOMENTO_API_KEY,
      agentCard: {
        name: 'Warehouse Management Agent',
        description: 'Manage inventory tracking, stock levels, product locations, and fulfillment operations',
        url: baseUrl,
        capabilities: {
          streaming: false,
          pushNotifications: false
        }
      },
      skills: [
        {
          id: 'allocate-inventory',
          name: 'Allocate Inventory',
          description: 'Reserve inventory for replacement orders with quantity validation and availability checking',
          examples: [
            'Allocate 5 units of product PRD-789 for order ORD-12345',
            'Reserve inventory for replacement order',
            'Check and allocate available stock for redelivery'
          ],
          tags: ['inventory', 'warehouse', 'allocation', 'stock-management']
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
};

export const handler = async (event) => {
  try {
    const { request, baseUrl } = lambdaEventToRequest(event);
    const agentInstance = await getAgent(baseUrl);
    const response = await agentInstance.fetch(request);

    const body = await response.text();
    const headers = Object.fromEntries(response.headers.entries());
    const output = {
      statusCode: response.status,
      headers,
      body
    };
    console.log(JSON.stringify(output));
    return output;
  } catch (error) {
    console.error('Warehouse agent error:', error);
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

const agentHandler = async (message, { task, publishUpdate }) => {
  const systemPrompt = `You are a warehouse management agent for SwiftShip demo system. You specialize in inventory allocation for delivery scenarios.

## Core Capability

You have access to one essential tool for demo scenarios:

### allocateInventory - Simplified Inventory Allocation
**Purpose**: Reserve inventory for replacement orders in demo scenarios
**Key Features**:
- Allocate inventory for specific products and orders
- Simple validation for demo reliability
- Check available quantities and prevent over-allocation
- Emit A2A events for real-time monitoring in the demo UI

## Demo Guidelines:
- Focus on quick, reliable inventory allocation for demo scenarios
- Provide clear confirmation messages with allocation details
- Handle insufficient inventory gracefully
- Always include scenarioId when provided for A2A event tracking

This is a demonstration system - all inventory operations are simulated for demo purposes.`;

  const tools = convertToBedrockTools([
    allocateInventory
  ]);

  const context = {
    taskId: task.id,
    tenantId: 'demo-tenant',
    sessionId: 'session-' + Date.now(),
    publishUpdate
  };
  console.log('Processing message', message);
  const response = await converse(process.env.MODEL_ID, systemPrompt, message, tools, context);
  return response;
};
