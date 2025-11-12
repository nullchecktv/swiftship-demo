import { z } from 'zod';
import { createMomentoAgent } from 'momento-a2a-agent';
import { converse } from '../utils/agents.mjs';
import { processRefundTool } from '../tools/process-refund.mjs';

let agent;

const getAgent = async (baseUrl) => {
  if (!agent) {
    const agentParams = {
      cacheName: 'mcp',
      apiKey: process.env.MOMENTO_API_KEY,
      agentCard: {
        name: 'Payment Management Agent',
        description: 'Process payments, manage transaction status, handle refunds, and verify payment integrity',
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
          description: 'Process refunds for failed delivery scenarios including delivery failures, damaged packages, and customer requests',
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
    console.error('Payment agent error:', error);
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
const convertToBedrockTools = (toolDefs) => {
  return toolDefs.map(toolDef => {
    return {
      isMultiTenant: toolDef.isMultiTenant,
      spec: {
        name: toolDef.name,
        description: toolDef.description,
        inputSchema: { json: z.toJSONSchema(toolDef.schema) }
      },
      handler: toolDef.handler
    };
  });
};

const agentHandler = async (message) => {
  const systemPrompt = `You are a payment management agent for SwiftShip demo system. You specialize in processing refunds for delivery scenarios.

## Core Capability

You have access to one essential tool for demo scenarios:

### processRefund - Simplified Refund Processing
**Purpose**: Process refunds for failed delivery scenarios in the demo
**Key Features**:
- Process refunds for orders with delivery failures
- Support common refund reasons: delivery_failed, damaged_package, customer_request
- Simple validation and processing for demo reliability
- Emit A2A events for real-time monitoring in the demo UI

## Demo Guidelines:
- Focus on quick, reliable refund processing for demo scenarios
- Provide clear confirmation messages
- Handle errors gracefully with simple explanations
- Always include scenarioId when provided for A2A event tracking

This is a demonstration system - all refund processing is simulated for demo purposes.`;

  // Use only the essential refund tool for demo
  const tools = convertToBedrockTools([
    processRefundTool
  ]);

  // Extract tenantId from message context - this would need to be implemented based on how Momento passes context
  // For now, using a placeholder that would need to be properly implemented
  const context = {
    tenantId: 'demo-tenant', // This should be extracted from the actual request context
    sessionId: 'session-' + Date.now()
  };

  const response = await converse(process.env.MODEL_ID, systemPrompt, message, tools, context);
  return { message: response };
};
