#!/usr/bin/env node

// Simple test script for triage agent direct response functionality
import { handler } from './functions/agents/triage.mjs';

const testDirectResponseScenarios = async () => {
  console.log('Testing Triage Agent Direct Response Handler...\n');

  const testCases = [
    {
      name: 'Company Information Inquiry',
      event: {
        eventType: 'company_info_request',
        tenantId: 'test-tenant-123',
        eventId: 'test-event-001',
        timestamp: new Date().toISOString(),
        payload: {
          customerName: 'John Doe',
          question: 'What are your company hours?',
          inquiryType: 'company_info'
        }
      }
    },
    {
      name: 'Shipping Policy Question',
      event: {
        eventType: 'shipping_policy_inquiry',
        tenantId: 'test-tenant-123',
        eventId: 'test-event-002',
        timestamp: new Date().toISOString(),
        payload: {
          customerName: 'Jane Smith',
          question: 'What are your shipping options and costs?',
          inquiryType: 'shipping_policy'
        }
      }
    },
    {
      name: 'Return Policy Question',
      event: {
        eventType: 'return_policy_inquiry',
        tenantId: 'test-tenant-123',
        eventId: 'test-event-003',
        timestamp: new Date().toISOString(),
        payload: {
          question: 'How do I return an item?',
          inquiryType: 'returns'
        }
      }
    },
    {
      name: 'General Greeting',
      event: {
        eventType: 'general_inquiry',
        tenantId: 'test-tenant-123',
        eventId: 'test-event-004',
        timestamp: new Date().toISOString(),
        payload: {
          customerName: 'Bob Johnson',
          question: 'Hello, how can you help me?',
          inquiryType: 'general'
        }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);

    try {
      const result = await handler(testCase.event);

      console.log(`Status Code: ${result.statusCode}`);

      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        console.log(`Success: ${body.success}`);
        console.log(`Event ID: ${body.eventId}`);
        console.log(`Response Type: ${body.results?.type}`);
        console.log(`Handled By: ${body.results?.handledBy}`);

        if (body.results?.response) {
          console.log(`Response Preview: ${body.results.response.substring(0, 100)}...`);
        }
      } else {
        const body = JSON.parse(result.body);
        console.log(`Error: ${body.error?.message}`);
      }

    } catch (error) {
      console.error(`Test failed: ${error.message}`);
    }

    console.log('---');
  }
};

// Run the tests
testDirectResponseScenarios().catch(console.error);
