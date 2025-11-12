import { AmazonBedrockOrchestrator } from 'momento-a2a-agent';
import { sendCustomerEmailTool } from '../tools/send-email.mjs';
import { z } from 'zod';
export const handler = async (event) => {
  let detail;

  try {
    const { detail } = event;

    const systemPrompt = `You are analyzing a delivery exception to determine the appropriate handling strategy.

YOUR TASK:
Analyze this exception and orchestrate the appropriate agents to resolve it.

HANDLING STRATEGIES:

SIMPLE RETRY SCENARIOS:
- "Customer Not Home" (first attempt) →
  1. Invoke OrderAgent to recreate order for next delivery attempt
  2. Notify customer of rescheduled delivery via the "sendCustomerEmail" tool

- "Access Issue" / "Gate Code Needed" →
  1. Contact customer for access information via the "sendCustomerEmail" tool
  2. Invoke OrderAgent to update order status as "pending customer response"

DAMAGED/LOST PACKAGE:
- "Damaged Package" / "Unusual Package Condition" →
  1. Invoke PaymentAgent to process refund for delivery ${detail.deliveryId}
  2. Invoke WarehouseAgent to allocate inventory for replacement
  3. Invoke OrderAgent to recreate order with allocated inventory
  4. Notify customer of refund + replacement via the "sendCustomerEmail" tool

HIGH-VALUE ORDERS (>$200):
If damaged/lost:
  1. Invoke PaymentAgent with priority flag for expedited refund
  2. Invoke WarehouseAgent to verify and allocate replacement inventory
  3. Invoke OrderAgent to recreate order with priority shipping
  4. Send apology + expedited tracking info via the "sendCustomerEmail" tool

MULTIPLE FAILED ATTEMPTS (3+):
  1. Notify customer to arrange alternative delivery or pickup via "sendCustomerEmail" tool
  2. If customer unreachable after 24hrs:
     - Invoke PaymentAgent to process refund
     - Invoke OrderAgent to update status as "cancelled - undeliverable"
     - Send final notification via the "sendCustomerEmail" tool

COMPLETE LOSS/THEFT:
  1. Invoke PaymentAgent to process full refund immediately
  2. Invoke WarehouseAgent to allocate replacement inventory
  3. Invoke OrderAgent to recreate order (if inventory available)
  4. Notify customer and provide options via the "sendCustomerEmail" tool

RESPONSE FORMAT:
Provide a clear summary including:
- Exception Classification
- Agents Invoked (in order)
- Actions Completed
- Current Status (resolved/pending/requires follow-up)
- Customer Impact (what they should expect next)

If the exception doesn't match these patterns, notify the customer there was an issue via the "sendCustomerEmail" tool`;

    const message = `DELIVERY EXCEPTION DETAILS:
- Delivery ID: ${detail.deliveryId}
- Exception Type: ${detail.status.status}
- Driver Notes: "${detail.status.reason}"
${detail.orderValue ? `- Order Value: $${detail.orderValue}` : ''}
`;
    const params = {
      momento: {
        apiKey: process.env.MOMENTO_API_KEY,
        cacheName: process.env.MOMENTO_CACHE_NAME
      },
      bedrock: {
        modelId: process.env.MODEL_ID
      },
      config: {
        systemPrompt: systemPrompt,
        preserveThinkingTags: false,
        agentLoadingConcurrency: 2,
        // tools: [{
        //   name: sendCustomerEmailTool.name,
        //   description: sendCustomerEmailTool.description,
        //   schema: z.toJSONSchema(sendCustomerEmailTool.schema),
        //   handler: sendCustomerEmailTool.handler
        // }]
      }
    };
    console.log(JSON.stringify(params));
    const agent = new AmazonBedrockOrchestrator(params);
    console.log('init');
    agent.registerAgents([
      process.env.ORDER_AGENT_URL,
      process.env.PAYMENT_AGENT_URL,
      process.env.WAREHOUSE_AGENT_URL
    ]);
    console.log('registered');
    const response = await agent.sendMessage({
      contextId: detail.contextId,
      message
    });

    console.log(response);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: response
      })
    };

  } catch (error) {
    console.error('Triage agent error:', {
      error: error.message,
      eventId: detail?.eventId,
      tenantId: detail?.tenantId
    });
  }
};
