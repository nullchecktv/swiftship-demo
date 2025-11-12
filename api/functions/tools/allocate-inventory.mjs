import { z } from 'zod';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'crypto';

const ddb = new DynamoDBClient();

export const allocateInventory = {
  isMultiTenant: true,
  name: 'allocateInventory',
  description: 'Reserve inventory for demo scenarios (simplified inventory allocation)',
  schema: z.object({
    orderId: z.string().min(1).describe('Required order identifier for the allocation'),
    productId: z.string().min(1).describe('Product identifier to allocate'),
    quantity: z.number().int().positive().describe('Quantity to allocate (must be positive)'),
    scenarioId: z.string().optional().describe('Demo scenario identifier for A2A event tracking')
  }),
  handler: async (tenantId, { orderId, productId, quantity, scenarioId }) => {
    try {
      if (!tenantId) {
        console.error('Missing tenantId in allocateInventory handler');
        return 'Unauthorized: Missing tenant context';
      }



      const now = new Date().toISOString();

      // Get current inventory for this product (simplified for demo)
      const pk = `${tenantId}#inventory`;
      const sk = `product#${productId}`;

      const inventoryResponse = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ pk, sk })
      }));

      if (!inventoryResponse.Item) {
        const errorMessage = `Allocation failed: Product ${productId} not found in inventory`;
        return errorMessage;
      }

      const inventoryItem = unmarshall(inventoryResponse.Item);
      const availableQuantity = inventoryItem.availableQuantity || 0;

      // Check if sufficient inventory is available
      if (availableQuantity < quantity) {
        const errorMessage = `Allocation failed: Product ${productId} has insufficient inventory (${availableQuantity} available, ${quantity} requested)`;
        return errorMessage;
      }

      // Create allocation record
      const allocationId = randomUUID();
      const allocationRecord = {
        pk: `${tenantId}#allocations`,
        sk: `${orderId}#${productId}`,
        GSI1PK: `${tenantId}#allocations#${productId}`,
        GSI1SK: `${now}#${orderId}`,
        allocationId,
        orderId,
        productId,
        quantityAllocated: quantity,
        status: 'allocated',
        createdAt: now,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days retention
      };

      // Update inventory available quantity
      const newAvailableQuantity = availableQuantity - quantity;
      const newAllocatedQuantity = (inventoryItem.allocatedQuantity || 0) + quantity;

      // Store allocation record
      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(allocationRecord)
      }));

      // Update inventory
      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ pk, sk }),
        UpdateExpression: 'SET availableQuantity = :newAvailable, allocatedQuantity = :newAllocated, updatedAt = :now',
        ExpressionAttributeValues: marshall({
          ':newAvailable': newAvailableQuantity,
          ':newAllocated': newAllocatedQuantity,
          ':now': now
        })
      }));

      const successMessage = `Successfully allocated ${quantity} units of ${productId} for order ${orderId}`;



      return successMessage;

    } catch (err) {
      console.error('Error allocating inventory:', err);
      const errorMessage = `Something went wrong while allocating inventory for order ${orderId}`;



      return errorMessage;
    }
  }
};
