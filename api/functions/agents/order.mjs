import { createAgent } from 'momento-a2a-agent';
import { buildRequest } from '../utils/api.mjs';
import { converse, convertToBedrockTools } from '../utils/agents.mjs';
import { changeOrderStatus } from '../tools/change-order-status.mjs';
import { duplicateOrder } from '../tools/duplicate-order.mjs';

let agent;

const getAgent = async (baseUrl) => {
  if (!agent) {
    const agentParams = {
      agentCard: {
        name: 'Order Management Agent',
        description: 'Manage shipping orders, statuses, and order operations for SwiftShip Logistics',
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
          description: 'Update order status including delivery failures and status transitions',
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

const agentHandler = async (message) => {
  const systemPrompt = `## Role
You are the Order Management Agent for SwiftShip Logistics, specializing in order status updates and order duplication for redelivery scenarios.

## Instructions
Manage shipping orders using two core tools:
- changeOrderStatus: Update order status including delivery_failed states
- duplicateOrder: Create replacement orders with optional customer/address overrides

## Steps
1. Validate the requested operation and required parameters
2. For status changes:
   - Verify order exists
   - Update status with appropriate reason
3. For order duplication:
   - Retrieve original order details
   - Apply any customer or address overrides
   - Create new order with updated information
4. Provide clear confirmation with order details

## End Goal
Execute order operations reliably while maintaining data integrity and providing clear confirmation of all changes.

## Narrowing
- Only modify orders that exist in the system
- Status changes must use valid status values
- Order duplication requires a valid source order`;

  const tools = convertToBedrockTools([changeOrderStatus, duplicateOrder]);

  const context = {
    tenantId: 'example-tenant',
    sessionId: 'session-' + Date.now()
  };

  const response = await converse(process.env.MODEL_ID, systemPrompt, message, tools, context);
  return { message: response };
};
