import { handler } from './functions/delivery/update-status.mjs';

// Set up test environment variables
process.env.TABLE_NAME = 'test-table';
process.env.MOMENTO_API_KEY = 'test-key';
process.env.MOMENTO_CACHE_NAME = 'test-cache';

// Test the delivery status update handler
const testDeliveryStatusUpdate = async () => {
  console.log('Testing delivery status update handler...');

  // Mock event data
  const mockEvent = {
    pathParameters: {
      id: 'DEL-TEST-001'
    },
    body: JSON.stringify({
      orderId: 'ORD-TEST-001',
      exceptionType: 'Customer Not Home',
      notes: 'Customer was not available at the delivery address. Left delivery notice.',
      contextId: 'ctx_test_' + Date.now(),
      timestamp: new Date().toISOString(),
      photos: [],
      driverInfo: {
        sessionId: 'session_123',
        deviceId: 'device_456'
      }
    })
  };

  try {
    const result = await handler(mockEvent);
    console.log('✅ Handler executed successfully');
    console.log('Status Code:', result.statusCode);
    console.log('Response:', JSON.parse(result.body));

    if (result.statusCode === 202) {
      const response = JSON.parse(result.body);
      if (response.notifications && response.notifications.authToken && response.notifications.contextId) {
        console.log('✅ Momento token generated successfully');
        console.log('Context ID:', response.notifications.contextId);
        console.log('Token length:', response.notifications.authToken.length);
      } else {
        console.log('❌ Missing notifications in response');
      }
    } else {
      console.log('❌ Unexpected status code:', result.statusCode);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
};

// Test validation errors
const testValidationErrors = async () => {
  console.log('\nTesting validation errors...');

  // Test missing required fields
  const invalidEvent = {
    pathParameters: {
      id: 'DEL-TEST-002'
    },
    body: JSON.stringify({
      orderId: 'ORD-TEST-002',
      // Missing exceptionType and notes
      contextId: 'ctx_test_validation'
    })
  };

  try {
    const result = await handler(invalidEvent);
    console.log('✅ Validation test executed');
    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 400) {
      const response = JSON.parse(result.body);
      console.log('✅ Validation error handled correctly');
      console.log('Error details:', response.error.details);
    } else {
      console.log('❌ Expected 400 status code for validation error');
    }

  } catch (error) {
    console.error('❌ Validation test failed:', error.message);
  }
};

// Test missing delivery ID
const testMissingDeliveryId = async () => {
  console.log('\nTesting missing delivery ID...');

  const eventWithoutId = {
    pathParameters: null,
    body: JSON.stringify({
      orderId: 'ORD-TEST-003',
      exceptionType: 'Address Issue',
      notes: 'Address incomplete',
      contextId: 'ctx_test_no_id'
    })
  };

  try {
    const result = await handler(eventWithoutId);
    console.log('✅ Missing ID test executed');
    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 400) {
      const response = JSON.parse(result.body);
      console.log('✅ Missing delivery ID handled correctly');
      console.log('Error:', response.error.message);
    } else {
      console.log('❌ Expected 400 status code for missing delivery ID');
    }

  } catch (error) {
    console.error('❌ Missing ID test failed:', error.message);
  }
};

// Run all tests
const runTests = async () => {
  console.log('🚀 Starting delivery status API tests...\n');

  await testDeliveryStatusUpdate();
  await testValidationErrors();
  await testMissingDeliveryId();

  console.log('\n✨ All tests completed!');
};

runTests().catch(console.error);
