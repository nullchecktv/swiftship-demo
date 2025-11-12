import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId, scenarioType = 'full' } = event;

    await cleanupExistingData(tenantId);
    const scenarioData = await generateScenarioData(tenantId, scenarioType);
    await insertScenarioData(scenarioData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        dataCreated: {
          customers: scenarioData.customers.length,
          orders: scenarioData.orders.length,
          products: scenarioData.products.length,
          payments: scenarioData.payments.length,
          deliveryExceptions: scenarioData.deliveryExceptions.length
        }
      })
    };
  } catch (error) {
    console.error('Demo reset error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Something went wrong'
      })
    };
  }
};

const cleanupExistingData = async (tenantId) => {
  let lastEvaluatedKey = null;

  do {
    const scanResult = await ddb.send(new ScanCommand({
      TableName: process.env.TABLE_NAME,
      FilterExpression: 'begins_with(pk, :tenantPrefix)',
      ExpressionAttributeValues: marshall({ ':tenantPrefix': `${tenantId}#` }),
      ProjectionExpression: 'pk, sk'
    }));

    if (scanResult.Items?.length > 0) {
      for (let i = 0; i < scanResult.Items.length; i += 25) {
        const chunk = scanResult.Items.slice(i, i + 25);
        await ddb.send(new BatchWriteItemCommand({
          RequestItems: {
            [process.env.TABLE_NAME]: chunk.map(item => ({
              DeleteRequest: { Key: { pk: item.pk, sk: item.sk } }
            }))
          }
        }));
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);
};

const generateScenarioData = async (tenantId, scenarioType) => {
  if (scenarioType === 'minimal') {
    // Minimal scenario: 1 customer, 1 order, 1 product, 1 payment, 1 delivery exception
    return {
      customers: [generateCustomer(tenantId, 1)],
      orders: [generateOrder(tenantId, 1)],
      products: [generateProduct(tenantId, 1)],
      payments: [generatePayment(tenantId, 1)],
      deliveryExceptions: [generateDeliveryException(tenantId, 1, 'simple')]
    };
  } else {
    // Full scenario: 5 customers, 15 orders, 10 products, 15 payments, 5 delivery exceptions
    const customers = Array.from({ length: 5 }, (_, i) => generateCustomer(tenantId, i + 1));
    const orders = Array.from({ length: 15 }, (_, i) => generateOrder(tenantId, i + 1));
    const products = Array.from({ length: 10 }, (_, i) => generateProduct(tenantId, i + 1));
    const payments = Array.from({ length: 15 }, (_, i) => generatePayment(tenantId, i + 1));
    const deliveryExceptions = Array.from({ length: 5 }, (_, i) =>
      generateDeliveryException(tenantId, i + 1, i < 3 ? 'simple' : 'complex')
    );

    return { customers, orders, products, payments, deliveryExceptions };
  }
};

const generateCustomer = (tenantId, index) => {
  const customerId = `CUST-DEMO-${String(index).padStart(3, '0')}`;
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000); // 1 year from now

  return {
    pk: `${tenantId}#customers`,
    sk: `customer#${customerId}`,
    GSI1PK: `${tenantId}#customers`,
    GSI1SK: `${new Date().toISOString()}#${customerId}`,
    customerId,
    name: `Demo Customer ${index}`,
    email: `customer${index}@demo.com`,
    phone: `+1-555-${String(index).padStart(4, '0')}`,
    address: {
      street: `${100 + index} Demo Street`,
      city: 'Demo City',
      state: 'DC',
      zipCode: `${10000 + index}`,
      country: 'USA'
    },
    customerType: index <= 2 ? 'premium' : 'standard',
    registrationDate: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
    totalOrders: Math.floor(Math.random() * 5) + 1,
    totalSpent: Math.round((Math.random() * 1000 + 100) * 100) / 100,
    ttl
  };
};

const generateOrder = (tenantId, index) => {
  const orderId = `ORD-DEMO-${String(index).padStart(3, '0')}`;
  const customerId = `CUST-DEMO-${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`;
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  return {
    pk: `${tenantId}#orders`,
    sk: `order#${orderId}`,
    GSI1PK: `${tenantId}#orders#${status}`,
    GSI1SK: `${new Date().toISOString()}#${orderId}`,
    orderId,
    customerId,
    status,
    items: [{
      sku: `SKU-DEMO-${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`,
      name: `Demo Product ${index}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: Math.round((Math.random() * 200 + 50) * 100) / 100
    }],
    totalAmount: Math.round((Math.random() * 500 + 100) * 100) / 100,
    currency: 'USD',
    orderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    trackingNumber: `TRK-${orderId}`,
    paymentId: `PAY-DEMO-${String(index).padStart(3, '0')}`,
    ttl
  };
};

const generateProduct = (tenantId, index) => {
  const sku = `SKU-DEMO-${String(index).padStart(3, '0')}`;
  const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  return {
    pk: `${tenantId}#inventory`,
    sk: `product#${sku}`,
    GSI1PK: `${tenantId}#inventory#available`,
    GSI1SK: `${category}#${sku}`,
    sku,
    name: `Demo Product ${index}`,
    category,
    price: Math.round((Math.random() * 300 + 50) * 100) / 100,
    currency: 'USD',
    stockLevel: Math.floor(Math.random() * 100) + 10,
    reservedStock: Math.floor(Math.random() * 5),
    availableStock: Math.floor(Math.random() * 95) + 5,
    warehouse: 'WH-DEMO-001',
    supplier: 'Demo Supplier Inc',
    lastRestocked: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    ttl
  };
};

const generatePayment = (tenantId, index) => {
  const paymentId = `PAY-DEMO-${String(index).padStart(3, '0')}`;
  const orderId = `ORD-DEMO-${String(index).padStart(3, '0')}`;
  const customerId = `CUST-DEMO-${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`;
  const statuses = ['completed', 'pending', 'failed', 'refunded'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  return {
    pk: `${tenantId}#payments`,
    sk: `payment#${paymentId}`,
    GSI1PK: `${tenantId}#payments#${status}`,
    GSI1SK: `${new Date().toISOString()}#${paymentId}`,
    paymentId,
    orderId,
    customerId,
    amount: Math.round((Math.random() * 500 + 100) * 100) / 100,
    currency: 'USD',
    paymentMethod: 'credit_card',
    status,
    transactionId: `TXN-DEMO-${String(index).padStart(3, '0')}`,
    processedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    refundAmount: 0,
    ttl
  };
};

const generateDeliveryException = (tenantId, index, exceptionType) => {
  const exceptionId = `EXC-DEMO-${String(index).padStart(3, '0')}`;
  const orderId = `ORD-DEMO-${String(index).padStart(3, '0')}`;
  const customerId = `CUST-DEMO-${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`;
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  // Define simple and complex exception scenarios
  const simpleExceptions = [
    {
      type: 'delivery_failed',
      reason: 'Customer not available',
      severity: 'medium',
      description: 'Customer was not available at delivery address during attempted delivery',
      actionRequired: 'reschedule_delivery',
      estimatedResolution: '1-2 business days'
    },
    {
      type: 'address_issue',
      reason: 'Incorrect address',
      severity: 'medium',
      description: 'Delivery address provided is incomplete or incorrect',
      actionRequired: 'contact_customer',
      estimatedResolution: '1 business day'
    },
    {
      type: 'weather_delay',
      reason: 'Severe weather conditions',
      severity: 'low',
      description: 'Delivery delayed due to severe weather in delivery area',
      actionRequired: 'monitor_weather',
      estimatedResolution: '2-3 business days'
    }
  ];

  const complexExceptions = [
    {
      type: 'package_damaged',
      reason: 'Package damaged during transit',
      severity: 'high',
      description: 'Package sustained significant damage during shipping, contents may be compromised',
      actionRequired: 'replacement_required',
      estimatedResolution: '3-5 business days',
      requiresInventoryCheck: true,
      requiresRefund: false,
      affectedItems: ['primary_item'],
      replacementEligible: true
    },
    {
      type: 'lost_package',
      reason: 'Package lost in transit',
      severity: 'high',
      description: 'Package cannot be located in shipping network, presumed lost',
      actionRequired: 'investigate_and_replace',
      estimatedResolution: '5-7 business days',
      requiresInventoryCheck: true,
      requiresRefund: true,
      affectedItems: ['all_items'],
      replacementEligible: true,
      investigationRequired: true
    },
    {
      type: 'delivery_theft',
      reason: 'Package stolen after delivery',
      severity: 'high',
      description: 'Package was delivered but subsequently stolen from delivery location',
      actionRequired: 'file_claim_and_replace',
      estimatedResolution: '7-10 business days',
      requiresInventoryCheck: true,
      requiresRefund: true,
      affectedItems: ['all_items'],
      replacementEligible: true,
      investigationRequired: true,
      requiresPoliceReport: true
    }
  ];

  // Select exception based on type
  const exceptionTemplates = exceptionType === 'simple' ? simpleExceptions : complexExceptions;
  const selectedTemplate = exceptionTemplates[Math.floor(Math.random() * exceptionTemplates.length)];

  // Base exception data
  const baseException = {
    pk: `${tenantId}#delivery-exceptions`,
    sk: `exception#${exceptionId}`,
    GSI1PK: `${tenantId}#delivery-exceptions#${selectedTemplate.severity}`,
    GSI1SK: `${new Date().toISOString()}#${exceptionId}`,
    exceptionId,
    orderId,
    customerId,
    trackingNumber: `TRK-${orderId}`,
    status: 'open',
    type: selectedTemplate.type,
    severity: selectedTemplate.severity,
    reason: selectedTemplate.reason,
    description: selectedTemplate.description,
    actionRequired: selectedTemplate.actionRequired,
    estimatedResolution: selectedTemplate.estimatedResolution,
    reportedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdated: new Date().toISOString(),
    assignedAgent: null,
    resolutionNotes: null,
    customerNotified: false,
    ttl
  };

  // Add complex exception specific fields
  if (exceptionType === 'complex') {
    baseException.requiresInventoryCheck = selectedTemplate.requiresInventoryCheck || false;
    baseException.requiresRefund = selectedTemplate.requiresRefund || false;
    baseException.affectedItems = selectedTemplate.affectedItems || [];
    baseException.replacementEligible = selectedTemplate.replacementEligible || false;
    baseException.investigationRequired = selectedTemplate.investigationRequired || false;
    baseException.requiresPoliceReport = selectedTemplate.requiresPoliceReport || false;
    baseException.escalationLevel = 'high';
    baseException.approvalRequired = true;
  } else {
    baseException.escalationLevel = 'standard';
    baseException.approvalRequired = false;
  }

  // Add delivery attempt history for failed delivery scenarios
  if (selectedTemplate.type === 'delivery_failed') {
    baseException.deliveryAttempts = [
      {
        attemptNumber: 1,
        attemptDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'failed',
        reason: 'Customer not available',
        driverNotes: 'No answer at door, left delivery notice'
      },
      {
        attemptNumber: 2,
        attemptDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'failed',
        reason: 'Customer not available',
        driverNotes: 'Customer not home during delivery window'
      }
    ];
    baseException.nextAttemptScheduled = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  // Add location data for address issues
  if (selectedTemplate.type === 'address_issue') {
    baseException.addressIssues = {
      originalAddress: {
        street: '123 Main St',
        city: 'Unknown City',
        state: 'XX',
        zipCode: '00000'
      },
      issueDetails: 'Apartment number missing, building not found at specified address',
      suggestedCorrection: null
    };
  }

  // Add weather data for weather delays
  if (selectedTemplate.type === 'weather_delay') {
    baseException.weatherInfo = {
      condition: 'severe_storm',
      affectedArea: 'Metro delivery zone',
      expectedClearance: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      alternativeRoutes: false
    };
  }

  return baseException;
};

const insertScenarioData = async (scenarioData) => {
  const allItems = [
    ...scenarioData.customers,
    ...scenarioData.products,
    ...scenarioData.orders,
    ...scenarioData.payments,
    ...scenarioData.deliveryExceptions
  ];

  for (let i = 0; i < allItems.length; i += 25) {
    const chunk = allItems.slice(i, i + 25);
    await ddb.send(new BatchWriteItemCommand({
      RequestItems: {
        [process.env.TABLE_NAME]: chunk.map(item => ({
          PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) }
        }))
      }
    }));
  }
};
