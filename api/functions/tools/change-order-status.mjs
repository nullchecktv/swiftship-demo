import { z } from 'zod';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();

export const changeOrderStatus = {
  isMultiTenant: true,
  name: 'changeOrderStatus',
  description: 'Updates the status of an existing order for demo scenarios (simplified status management)',
  schema: z.object({
    orderId: z.string().min(1).describe('The unique identifier of the order to update'),
    newStatus: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'delivery_failed'])
      .describe('The new status to set for the order'),
    notes: z.string().optional().describe('Optional notes about the status change'),
    scenarioId: z.string().optional().describe('Demo scenario identifier for A2A event tracking')
  }),
  handler: async (tenantId, { orderId, newStatus, notes, scenarioId }) => {
    try {
      if (!tenantId) {
        console.error('Missing tenantId in changeOrderStatus handler');
        return 'Unauthorized: Missing tenant context';
      }



      const pk = `${tenantId}#orders`;
      const sk = `order#${orderId}`;

      // First, retrieve the existing order
      const getResponse = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ pk, sk })
      }));

      if (!getResponse.Item) {
        return `Order ${orderId} not found`;
      }

      const existingOrder = unmarshall(getResponse.Item);
      const currentStatus = existingOrder.status;

      // Don't update if status is the same
      if (currentStatus === newStatus) {
        return `Order ${orderId} is already in ${newStatus} status`;
      }

      const now = new Date().toISOString();

      // Create status history entry
      const statusHistoryEntry = {
        status: newStatus,
        timestamp: now,
        ...(notes && { notes })
      };

      // Update the order with new status and status history
      const updateExpression = 'SET #status = :newStatus, #updatedAt = :updatedAt, #statusHistory = list_append(if_not_exists(#statusHistory, :emptyList), :statusEntry), GSI1PK = :gsi1pk';

      const expressionAttributeNames = {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#statusHistory': 'statusHistory'
      };

      const expressionAttributeValues = marshall({
        ':newStatus': newStatus,
        ':updatedAt': now,
        ':statusEntry': [statusHistoryEntry],
        ':emptyList': [],
        ':gsi1pk': `${tenantId}#orders#${newStatus}`
      });

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ pk, sk }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      const statusChangeMessage = notes
        ? `Order ${orderId} status changed from ${currentStatus} to ${newStatus}. Notes: ${notes}`
        : `Order ${orderId} status changed from ${currentStatus} to ${newStatus}`;



      return statusChangeMessage;

    } catch (err) {
      console.error('Error changing order status:', err);

      const errorMessage = err.name === 'ConditionalCheckFailedException'
        ? `Order ${orderId} not found or has been modified`
        : 'Something went wrong while updating the order status';



      return errorMessage;
    }
  }
};
