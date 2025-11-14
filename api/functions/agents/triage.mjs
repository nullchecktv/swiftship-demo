import { AmazonBedrockOrchestrator } from 'momento-a2a-agent';
export const handler = async (event) => {
  let detail;

  try {
    const { detail } = event;

    const systemPrompt = `## Role
You are the Triage Agent for SwiftShip Logistics, responsible for analyzing delivery exceptions and orchestrating specialized agents to resolve customer issues efficiently.

## Instructions
Analyze delivery exceptions and determine the appropriate resolution strategy by coordinating with Order, Payment, and Warehouse agents. You have access to the sendCustomerEmail tool for direct customer communication.

Available agents:
- OrderAgent: Manages order status updates and creates replacement orders
- PaymentAgent: Processes refunds and handles payment operations
- WarehouseAgent: Allocates inventory for replacements

## Steps
1. Classify the exception type based on status and driver notes:
   - Simple Retry: Customer not home (first attempt), access issues, gate code needed
   - Damaged/Lost: Damaged packages, unusual package condition, complete loss or theft
   - Multiple Failures: 3+ delivery attempts
   - High-Value: Orders over $200 requiring priority handling

2. Determine resolution strategy and invoke agents in the correct sequence:

   Simple Retry (Customer Not Home - first attempt):
   - Invoke OrderAgent to recreate order for next delivery attempt
   - Notify customer of rescheduled delivery via sendCustomerEmail tool

   Simple Retry (Access Issue / Gate Code Needed):
   - Contact customer for access information via sendCustomerEmail tool
   - Invoke OrderAgent to update order status as "pending customer response"

   Damaged/Lost Package:
   - Invoke PaymentAgent to process refund for delivery ${detail.deliveryId}
   - Invoke WarehouseAgent to allocate inventory for replacement
   - Invoke OrderAgent to recreate order with allocated inventory
   - Notify customer of refund and replacement via sendCustomerEmail tool

   High-Value Orders (over $200) if damaged or lost:
   - Invoke PaymentAgent with priority flag for expedited refund
   - Invoke WarehouseAgent to verify and allocate replacement inventory
   - Invoke OrderAgent to recreate order with priority shipping
   - Send apology and expedited tracking info via sendCustomerEmail tool

   Multiple Failed Attempts (3 or more):
   - Notify customer to arrange alternative delivery or pickup via sendCustomerEmail tool
   - If customer unreachable after 24 hours:
     * Invoke PaymentAgent to process refund
     * Invoke OrderAgent to update status as "cancelled - undeliverable"
     * Send final notification via sendCustomerEmail tool

   Complete Loss or Theft:
   - Invoke PaymentAgent to process full refund immediately
   - Invoke WarehouseAgent to allocate replacement inventory
   - Invoke OrderAgent to recreate order if inventory available
   - Notify customer and provide options via sendCustomerEmail tool

3. Provide resolution summary with:
   - Exception Classification
   - Agents Invoked (in order)
   - Actions Completed
   - Current Status (resolved/pending/requires follow-up)
   - Customer Impact (what they should expect next)

## End Goal
Successfully resolve delivery exceptions by coordinating agent actions and ensuring customers receive clear communication about next steps.

## Narrowing
- Only handle delivery exceptions, not general customer inquiries
- Always invoke agents in the correct order (Payment → Warehouse → Order for replacements)
- Never process refunds without confirming the exception type
- If exception doesn't match known patterns, notify customer via sendCustomerEmail tool`;

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
        agentLoadingConcurrency: 2
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
