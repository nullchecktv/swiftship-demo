import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall } from '@aws-sdk/util-dynamodb';
import { AuthClient, CredentialProvider, ExpiresIn, TopicRole } from '@gomomento/sdk';
import { formatResponse } from '../utils/api.mjs';
import { randomUUID } from 'crypto';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();
const authClient = new AuthClient({ credentialProvider: CredentialProvider.fromEnvironmentVariable('MOMENTO_API_KEY') });

export const handler = async (event) => {
  try {
    const { deliveryId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const contextId = event.headers?.['x-context-id'] || event.headers?.['X-Context-Id'] || randomUUID();
    const timestamp = new Date().toISOString();

    const statusRecord = {
      deliveryId,
      status: body.status,
      timestamp,
      location: body.location,
      driverId: body.driverId,
      reason: body.reason
    };

    await storeDeliveryStatus(deliveryId, statusRecord);
    await publishDeliveryEvent(deliveryId, statusRecord, contextId);

    const momentoToken = await generateMomentoToken(contextId);

    return formatResponse(202, {
      accepted: true,
      orderId: body.orderId,
      message: 'Delivery status update accepted for processing',
      notifications: {
        authToken: momentoToken,
        contextId
      }
    });

  } catch (error) {
    console.error('Delivery status update error:', error);
    return formatResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
};

const storeDeliveryStatus = async (deliveryId, statusRecord) => {
  const tenantId = 'demo-tenant';
  const pk = `${tenantId}#delivery#${deliveryId}`;
  const sk = `status#${statusRecord.timestamp}`;

  await ddb.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: marshall({
      pk,
      sk,
      ...statusRecord,
      tenantId
    })
  }));
};

const publishDeliveryEvent = async (deliveryId, statusRecord, contextId) => {
  const result = await eventBridge.send(new PutEventsCommand({
    Entries: [
      {
        Source: 'swiftship.delivery',
        DetailType: 'Delivery Status Update',
        Detail: JSON.stringify({
          deliveryId,
          tenantId: 'demo-tenant',
          contextId,
          status: statusRecord
        }),
        Time: new Date()
      }
    ]
  }));

  if (result.FailedEntryCount > 0) {
    const error = new Error('Failed to publish event to EventBridge');
    error.code = 'EVENT_PUBLISHING_FAILED';
    throw error;
  }
};

const generateMomentoToken = async (contextId) => {
  const tokenResponse = await authClient.generateDisposableToken({
    permissions: [{
      role: TopicRole.SubscribeOnly,
      cache: 'mcp',
      topic: contextId
    }]
  },
    ExpiresIn.minutes(10)
  );

 return tokenResponse.authToken;
};
