#!/usr/bin/env node

/**
 * Test script for the Triage Agent
 * Tests various scenarios including direct responses and agent delegation
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TRIAGE_AGENT_URL = process.env.TRIAGENT_URL || 'http://localhost:3000'; // Update with actual URL
const TEST_TENANT_ID = 'test-tenant-123';

// Test scenarios
const testScenarios = [
  {
    name: 'Company Information Inquiry (Direct Response)',
    description: 'Test direct response for general company information',
    event: {
      eventType: 'company_info_request',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-001',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'John Smith',
        email: 'john.smith@example.com',
        inquiryType: 'company_info',
        question: 'What are your business hours and locations?'
      },
      metadata: {
        source: 'web_chat',
        priority: 'normal'
      }
    },
    expectedType: 'direct_response'
  },

  {
    name: 'Shipping Policy Inquiry (Direct Response)',
    description: 'Test direct response for shipping policy questions',
    event: {
      eventType: 'shipping_policy_inquiry',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-002',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Sarah Johnson',
        email: 'sarah.j@example.com',
        inquiryType: 'shipping_policy',
        question: 'Do you offer free shipping? What are the delivery timeframes?'
      },
      metadata: {
        source: 'mobile_app',
        priority: 'normal'
      }
    },
    expectedType: 'direct_response'
  },

  {
    name: 'Return Policy Question (Direct Response)',
    description: 'Test direct response for return policy information',
    event: {
      eventType: 'return_policy_inquiry',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-003',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Mike Davis',
        email: 'mike.davis@example.com',
        inquiryType: 'return_policy',
        question: 'How long do I have to return an item? Is return shipping free?'
      },
      metadata: {
        source: 'email',
        priority: 'normal'
      }
    },
    expectedType: 'direct_response'
  },

  {
    name: 'Order Tracking Request (Agent Delegation)',
    description: 'Test delegation to order agent for specific order tracking',
    event: {
      eventType: 'order_tracking_request',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-004',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Lisa Chen',
        email: 'lisa.chen@example.com',
        inquiryType: 'order_tracking',
        orderId: 'ORD-12345',
        question: 'Where is my order #ORD-12345? When will it be delivered?'
      },
      metadata: {
        source: 'web_portal',
        priority: 'high'
      }
    },
    expectedType: 'agent_delegation',
    expectedAgents: ['order']
  },

  {
    name: 'Payment Issue (Agent Delegation)',
    description: 'Test delegation to payment agent for billing disputes',
    event: {
      eventType: 'payment_dispute',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-005',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Robert Wilson',
        email: 'robert.w@example.com',
        inquiryType: 'payment_issue',
        paymentId: 'PAY-67890',
        orderId: 'ORD-54321',
        amount: 89.99,
        question: 'I was charged twice for order #ORD-54321. Please process a refund.',
        action: 'process_refund'
      },
      metadata: {
        source: 'phone_call',
        priority: 'urgent'
      }
    },
    expectedType: 'agent_delegation',
    expectedAgents: ['payment']
  },

  {
    name: 'Inventory Check (Agent Delegation)',
    description: 'Test delegation to warehouse agent for product availability',
    event: {
      eventType: 'inventory_inquiry',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-006',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Emma Thompson',
        email: 'emma.t@example.com',
        inquiryType: 'product_availability',
        productIds: ['SKU-ABC123', 'SKU-DEF456'],
        question: 'Are these items in stock? When will they be available if not?'
      },
      metadata: {
        source: 'web_chat',
        priority: 'normal'
      }
    },
    expectedType: 'agent_delegation',
    expectedAgents: ['warehouse']
  },

  {
    name: 'Order Cancellation with Refund (Multi-Agent Sequential)',
    description: 'Test sequential workflow requiring both order and payment agents',
    event: {
      eventType: 'order_cancellation_with_refund',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-007',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'David Brown',
        email: 'david.brown@example.com',
        inquiryType: 'order_cancellation',
        orderId: 'ORD-98765',
        paymentId: 'PAY-11111',
        amount: 149.99,
        question: 'Please cancel my order #ORD-98765 and refund my payment.',
        action: 'cancel_and_refund'
      },
      metadata: {
        source: 'web_portal',
        priority: 'high'
      }
    },
    expectedType: 'agent_delegation',
    expectedAgents: ['order', 'payment'],
    expectedWorkflow: 'sequential'
  },

  {
    name: 'Complex Multi-Agent Request (Parallel)',
    description: 'Test parallel workflow with multiple agents',
    event: {
      eventType: 'complex_inquiry',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-008',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Jennifer Lee',
        email: 'jennifer.lee@example.com',
        inquiryType: 'complex_request',
        orderId: 'ORD-55555',
        paymentId: 'PAY-22222',
        productIds: ['SKU-XYZ789'],
        question: 'I need status on my order, payment confirmation, and inventory check for reorder.',
        action: 'status_check'
      },
      metadata: {
        source: 'mobile_app',
        priority: 'normal'
      }
    },
    expectedType: 'agent_delegation',
    expectedAgents: ['order', 'payment', 'warehouse'],
    expectedWorkflow: 'parallel'
  },

  {
    name: 'General Greeting (Direct Response)',
    description: 'Test direct response for general greetings and help requests',
    event: {
      eventType: 'general_greeting',
      tenantId: TEST_TENANT_ID,
      eventId: 'evt-009',
      timestamp: new Date().toISOString(),
      payload: {
        customerName: 'Alex Rodriguez',
        email: 'alex.r@example.com',
        inquiryType: 'general',
        question: 'Hello! How can SwiftShip help me today?'
      },
      metadata: {
        source: 'web_chat',
        priority: 'normal'
      }
    },
    expectedType: 'direct_response'
  },

  {
    name: 'Invalid Event Structure (Validation Error)',
    description: 'Test validation error handling for malformed events',
    event: {
      // Missing required fields
      eventType: '',
      tenantId: '',
      // Missing eventId
      payload: {
        question: 'This should fail validation'
      }
    },
    expectedError: true,
    expectedStatusCode: 400
  }
];

// Test execution functions
async function runTest(scenario) {
  console.log(`\n🧪 Running Test: ${scenario.name}`);
  console.log(`📝 Description: ${scenario.description}`);
  console.log(`📤 Event:`, JSON.stringify(scenario.event, null, 2));

  try {
    const startTime = Date.now();

    const response = await fetch(TRIAGE_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scenario.event)
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    const responseData = await response.json();

    console.log(`📥 Response Status: ${response.status}`);
    console.log(`⏱️  Response Time: ${responseTime}ms`);
    console.log(`📋 Response:`, JSON.stringify(responseData, null, 2));

    // Validate response against expectations
    const validation = validateResponse(scenario, response.status, responseData);

    if (validation.success) {
      console.log(`✅ Test PASSED: ${validation.message}`);
    } else {
      console.log(`❌ Test FAILED: ${validation.message}`);
    }

    return {
      scenario: scenario.name,
      success: validation.success,
      responseTime,
      statusCode: response.status,
      response: responseData,
      validation: validation.message
    };

  } catch (error) {
    console.log(`💥 Test ERROR: ${error.message}`);
    return {
      scenario: scenario.name,
      success: false,
      error: error.message,
      validation: 'Network or execution error'
    };
  }
}

function validateResponse(scenario, statusCode, responseData) {
  // Check for expected errors
  if (scenario.expectedError) {
    if (statusCode === (scenario.expectedStatusCode || 400)) {
      return {
        success: true,
        message: `Expected error response received with status ${statusCode}`
      };
    } else {
      return {
        success: false,
        message: `Expected error status ${scenario.expectedStatusCode || 400}, got ${statusCode}`
      };
    }
  }

  // Check for successful responses
  if (statusCode !== 200) {
    return {
      success: false,
      message: `Expected status 200, got ${statusCode}`
    };
  }

  if (!responseData.success) {
    return {
      success: false,
      message: `Response indicates failure: ${responseData.error?.message || 'Unknown error'}`
    };
  }

  // Validate response type
  if (scenario.expectedType) {
    const actualType = responseData.results?.type;
    if (actualType !== scenario.expectedType) {
      return {
        success: false,
        message: `Expected response type '${scenario.expectedType}', got '${actualType}'`
      };
    }
  }

  // Validate required agents for delegation
  if (scenario.expectedAgents) {
    const actualAgents = responseData.results?.requiredAgents || [];
    const expectedAgents = scenario.expectedAgents;

    const hasAllExpectedAgents = expectedAgents.every(agent => actualAgents.includes(agent));
    if (!hasAllExpectedAgents) {
      return {
        success: false,
        message: `Expected agents [${expectedAgents.join(', ')}], got [${actualAgents.join(', ')}]`
      };
    }
  }

  // Validate workflow type for multi-agent scenarios
  if (scenario.expectedWorkflow) {
    const actualWorkflow = responseData.results?.workflowType;
    if (actualWorkflow !== scenario.expectedWorkflow) {
      return {
        success: false,
        message: `Expected workflow '${scenario.expectedWorkflow}', got '${actualWorkflow}'`
      };
    }
  }

  return {
    success: true,
    message: 'All validations passed'
  };
}

async function runAllTests() {
  console.log('🚀 Starting Triage Agent Test Suite');
  console.log(`🎯 Target URL: ${TRIAGE_AGENT_URL}`);
  console.log(`🏢 Test Tenant: ${TEST_TENANT_ID}`);
  console.log(`📊 Total Tests: ${testScenarios.length}`);

  const results = [];
  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    const result = await runTest(scenario);
    results.push(result);

    if (result.success) {
      passedTests++;
    } else {
      failedTests++;
    }

    // Add delay between tests to avoid overwhelming the service
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n📈 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Success Rate: ${((passedTests / testScenarios.length) * 100).toFixed(1)}%`);

  // Print detailed results
  console.log('\n📋 DETAILED RESULTS');
  console.log('='.repeat(50));
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    console.log(`${status} ${result.scenario} (${time})`);
    if (!result.success) {
      console.log(`   └─ ${result.validation}`);
    }
  });

  return results;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check if URL is provided
  if (!process.env.TRIAGE_AGENT_URL && process.argv.length < 3) {
    console.log('❗ Usage: node test-triage-agent.mjs [TRIAGE_AGENT_URL]');
    console.log('   Or set TRIAGE_AGENT_URL environment variable');
    console.log('   Example: node test-triage-agent.mjs https://your-triage-agent-url.amazonaws.com');
    process.exit(1);
  }

  // Override URL if provided as argument
  if (process.argv[2]) {
    process.env.TRIAGE_AGENT_URL = process.argv[2];
  }

  runAllTests()
    .then(results => {
      const failedCount = results.filter(r => !r.success).length;
      process.exit(failedCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { testScenarios, runTest, runAllTests };
