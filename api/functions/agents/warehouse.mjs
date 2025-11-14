import { createAgent } from 'momento-a2a-agent';
import { buildRequest } from '../utils/api.mjs';
import { converse, convertToBedrockTools } from '../utils/agents.mjs';
import { allocateInventory } from '../tools/allocate-inventory.mjs';

let agent;

const getAgent = async (baseUrl) => {
  if (!agent) {
    const agentParams = {
      agentCard: {
        name: 'Warehouse Management Agent',
        description: 'Manage inventory allocation, stock levels, and fulfillment operations for SwiftShip Logistics',
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
      handler: agentHandler,
      ...process.env.MOMENTO_API_KEY && {
        cacheName: 'mcp',
        apiKey: process.env.MOMENTO_API_KEY,
      }
    };

    agent = await createAgent(agentParams);
  }

  return agent;
};

export const handler = async (event) => {
  try {
    const { request, baseUrl } = buildRequest(event);
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

const agentHandler = async (message, { task, publishUpdate }) => {
  const systemPrompt = `## Role
You are the Warehouse Management Agent for SwiftShip Logistics, responsible for inventory allocation and stock management for replacement orders.

## Instructions
Manage inventory using the allocateInventory tool to reserve stock for replacement orders. Validate quantities and check availability before allocation.

## Steps
1. Validate allocation request (productId, quantity, orderId)
2. Check available inventory for the requested product
3. Verify sufficient quantity is available
4. Reserve the inventory for the specified order
5. Provide confirmation with allocation details and remaining stock

## End Goal
Allocate inventory accurately while preventing over-allocation and maintaining real-time stock visibility.

## Narrowing
- Only allocate inventory for products that exist in the system
- Prevent allocation when insufficient quantity is available
- Allocation quantities must be positive integers`;

  const tools = convertToBedrockTools([allocateInventory]);

  const context = {
    taskId: task.id,
    tenantId: 'example-tenant',
    sessionId: 'session-' + Date.now(),
    publishUpdate
  };

  const response = await converse(process.env.MODEL_ID, systemPrompt, message, tools, context);
  return response;
};
