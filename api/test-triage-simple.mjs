#!/usr/bin/env node

const TRIAGE_AGENT_URL = process.argv[2] || process.env.TRIAGE_AGENT_URL || 'http://localhost:3000';
const TEST_TYPE = process.argv[3] || 'company_info';

// Quick test scenarios
const quickTests = {
  company_info: {
    eventType: 'company_info_request',
    tenantId: 'test-tenant-123',
    eventId: 'quick-test-001',
    payload: {
      customerName: 'Test User',
      email: 'test@example.com',
      inquiryType: 'company_info',
      question: 'What are your business hours?'
    }
  },

  order_tracking: {
    eventType: 'order_tracking_request',
    tenantId: 'test-tenant-123',
    eventId: 'quick-test-002',
    payload: {
      customerName: 'Test User',
      email: 'test@example.com',
      orderId: 'ORD-12345',
      question: 'Where is my order #ORD-12345?'
    }
  },

  payment_issue: {
    eventType: 'payment_dispute',
    tenantId: 'test-tenant-123',
    eventId: 'quick-test-003',
    payload: {
      customerName: 'Test User',
      email: 'test@example.com',
      paymentId: 'PAY-67890',
      orderId: 'ORD-54321',
      amount: 89.99,
      question: 'I was charged twice, please refund.',
      action: 'process_refund'
    }
  },

  inventory_check: {
    eventType: 'inventory_inquiry',
    tenantId: 'test-tenant-123',
    eventId: 'quick-test-004',
    payload: {
      customerName: 'Test User',
      email: 'test@example.com',
      productIds: ['SKU-ABC123'],
      question: 'Is this item in stock?'
    }
  },

  multi_agent: {
    eventType: 'order_cancellation_with_refund',
    tenantId: 'test-tenant-123',
    eventId: 'quick-test-005',
    payload: {
      customerName: 'Test User',
      email: 'test@example.com',
      orderId: 'ORD-98765',
      paymentId: 'PAY-11111',
      amount: 149.99,
      question: 'Cancel my order and refund payment.',
      action: 'cancel_and_refund'
    }
  },

  greeting: {
    eventType: 'general_greeting',
    tenantId: 'test-tenant-123',
    eventId: 'quick-test-006',
    payload: {
      customerName: 'Test User',
      email: 'test@example.com',
      question: 'Hello! How can you help me?'
    }
  }
};

async function runQuickTest() {
  const testEvent = quickTests[TEST_TYPE];

  if (!testEvent) {
    console.log('❗ Invalid test type. Available options:');
    Object.keys(quickTests).forEach(key => {
      console.log(`   - ${key}`);
    });
    process.exit(1);
  }

  console.log(`🧪 Testing: ${TEST_TYPE}`);
  console.log(`🎯 URL: ${TRIAGE_AGENT_URL}`);
  console.log(`📤 Event:`, JSON.stringify(testEvent, null, 2));

  try {
    const startTime = Date.now();

    const response = await fetch(TRIAGE_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEvent)
    });

    const endTime = Date.now();
    const responseData = await response.json();

    console.log(`\n📥 Response (${endTime - startTime}ms):`);
    console.log(`Status: ${response.status}`);
    console.log(`Body:`, JSON.stringify(responseData, null, 2));

    if (response.status === 200 && responseData.success) {
      console.log('\n✅ Test completed successfully!');

      if (responseData.results?.type === 'direct_response') {
        console.log('📝 Direct Response:', responseData.results.response);
      } else if (responseData.results?.type === 'agent_delegation') {
        console.log('🤖 Delegated to agents:', responseData.results.requiredAgents?.join(', '));
        console.log('🔄 Workflow type:', responseData.results.workflowType);
      }
    } else {
      console.log('\n❌ Test failed');
    }

  } catch (error) {
    console.log(`\n💥 Error: ${error.message}`);
    process.exit(1);
  }
}

// Show usage if no URL provided
if (!TRIAGE_AGENT_URL || TRIAGE_AGENT_URL === 'http://localhost:3000') {
  console.log('📋 Usage: node test-triage-simple.mjs [URL] [test-type]');
  console.log('');
  console.log('Available test types:');
  Object.keys(quickTests).forEach(key => {
    console.log(`  - ${key}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  node test-triage-simple.mjs https://your-url.com company_info');
  console.log('  node test-triage-simple.mjs https://your-url.com order_tracking');
  console.log('');

  if (TRIAGE_AGENT_URL === 'http://localhost:3000') {
    console.log('⚠️  Using default localhost URL. Update with your actual function URL.');
  }
}

runQuickTest();
