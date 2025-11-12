import { z } from 'zod';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'crypto';

const ddb = new DynamoDBClient();

const addressSchema = z.object({
  street: z.string().min(1).describe('Street address'),
  city: z.string().min(1).describe('City name'),
  state: z.string().min(1).describe('State or province'),
  zipCode: z.string().min(1).describe('Postal code'),
  country: z.string().default('US').describe('Country code')
});

export const duplicateOrder = {
  isMultiTenant: true,
  name: 'duplicateOrder',
  description: 'Creates a duplicate of an existing order for demo scenarios (simple replacement order creation)',
  schema: z.object({
    originalOrderId: z.string().min(1).describe('The unique identifier of the order to duplicate'),
    customerId: z.string().optional().describe('Optional customer ID to override the original customer'),
    shippingAddress: addressSchema.optional().describe('Optional shipping address to override the original address'),
    scenarioId: z.string().optional().describe('Demo scenario identifier for A2A event tracking')
  }),
  handler: async (tenantId, { originalOrderId, customerId, shippingAddress, scenarioId }) => {
    try {
      if (!tenantId) {
        console.error('Missing tenantId in duplicateOrder handler');
        return 'Unauthorized: Missing tenant context';
      }



      const pk = `${tenantId}#orders`;
      const originalSk = `order#${originalOrderId}`;

      // Retrieve the original order
      const getResponse = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ pk, sk: originalSk })
      }));

      if (!getResponse.Item) {
        return `Original order ${originalOrderId} not found`;
      }

      const originalOrder = unmarshall(getResponse.Item);

      // Generate new order details
      const newOrderId = randomUUID();
      const now = new Date().toISOString();
      const newSk = `order#${newOrderId}`;

      // Create the duplicate order with overrides
      const duplicateOrder = {
        ...originalOrder,
        pk,
        sk: newSk,
        GSI1PK: `${tenantId}#orders#pending`,
        GSI1SK: `${now}#${newOrderId}`,
        orderId: newOrderId,
        status: 'pending',
        statusHistory: [{
          status: 'pending',
          timestamp: now,
          notes: `Duplicated from order ${originalOrderId}`
        }],
        createdAt: now,
        updatedAt: now,
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
      };

      // Apply customer override if provided
      if (customerId) {
        duplicateOrder.customerId = customerId;
      }

      // Apply shipping address override if provided
      if (shippingAddress) {
        duplicateOrder.shippingAddress = shippingAddress;
      }

      // Create the duplicate order in DynamoDB
      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        Item: marshall(duplicateOrder)
      }));

      let resultMessage = `Order ${newOrderId} created as duplicate of ${originalOrderId}`;

      if (customerId) {
        resultMessage += ` with customer ID ${customerId}`;
      }

      if (shippingAddress) {
        resultMessage += ` with updated shipping address`;
      }



      return resultMessage;

    } catch (err) {
      console.error('Error duplicating order:', err);

      const errorMessage = err.name === 'ConditionalCheckFailedException'
        ? 'Failed to create duplicate order - order ID conflict detected'
        : 'Something went wrong while duplicating the order';



      return errorMessage;
    }
  }
};
