import { createAgent } from 'momento-a2a-agent';
import { converse, convertToBedrockTools } from '../utils/agents.mjs';
import { processRefundTool } from '../tools/process-refund.mjs';
import { buildRequest } from '../utils/api.mjs';

let agent;

const getAgent = async (baseUrl) => {
  if (!agent) {
    const agentParams = {
      agentCard: {
        name: 'Payment Management Agent',
        description: 'Processes refunds for delivery failures, damaged packages, and customer requests with transaction integrity',
        url: baseUrl,
        capabilities: {
          streaming: false,
          pushNotifications: false
        }
      },
      skills: [
        {
          id: 'process-refund',
          name: 'Process Refund',
          description: 'Processes refunds for delivery failures, damaged packages, and customer-initiated requests',
          examples: [
            'Process refund for order ORD-12345 due to delivery failure',
            'Issue refund for damaged package',
            'Process customer-requested refund'
          ],
          tags: ['payment', 'refund', 'delivery-failure', 'customer-service']
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
    console.error('Payment agent error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Something went wrong' }),
    };
  }
};

const agentHandler = async (message) => {
  const systemPrompt = `## Role
You are the Payment Management Agent for SwiftShip Logistics, responsible for processing refunds for delivery failures and customer requests.

## Instructions
Process refunds using the processRefund tool for three primary scenarios:
- delivery_failed: Packages that could not be delivered
- damaged_package: Items damaged during transit
- customer_request: Customer-initiated refund requests

## Steps
1. Validate refund request parameters (orderId, reason, amount)
2. Verify the refund reason is valid
3. Process the refund transaction
4. Provide confirmation with refund amount and expected timeline

## End Goal
Process refunds accurately and efficiently while maintaining transaction integrity and providing clear confirmation to requesting agents.

## Narrowing
- Only process refunds for valid orders
- Refund reasons must be one of: delivery_failed, damaged_package, customer_request
- Refund amounts must not exceed original order value`;

  const tools = convertToBedrockTools([processRefundTool]);

  const context = {
    tenantId: 'example-tenant',
    sessionId: 'session-' + Date.now()
  };

  const response = await converse(process.env.MODEL_ID, systemPrompt, message, tools, context);
  return { message: response };
};
