#!/usr/bin/env node

// Test script for delivery exception handling in triage agent
import { handler } from './functions/agents/triage.mjs';

// Test data for simple delivery exception
const simpleDeliveryException = {
  eventType: 'delivery_exception',
  tenantId: 'demo-tenant',
  eventId: 'evt-test-simple-001',
  timestamp: new Date().toISOString(),
  payload: {
    orderId: 'B456',
    exceptionType: 'Customer Not Home',
    driverNotes: 'Customer not available, left notice. Will retry tomorrow.',
    driverInfo: {
      name: 'Dave M.',
      route: '847',
      timestamp: new Date().toISOString()
    },
    attachments: ['IMG_2847.jpg'],
    location: {
      lat: 40.7128,
      lng: -74.0060,
      address: 'Customer delivery address'
    }
  },
  metadata: {
    source: 'driver_portal',
    priority: 'normal',
    scenarioType: 'simple'
  }
};

// Test data for complex delivery exception
const complexDeliveryException = {
  eventType: 'delivery_exception',
  tenantId: 'demo-tenant',
  eventId: 'evt-test-complex-001',
  timestamp: new Date().toISOString(),
  payload: {
    orderId: 'C789',
    exceptionType: 'Damaged/Unusual Package',
    driverNotes: 'Package was making weird noises and smelled funny. Left it at depot for safety. Customer complained about previous delivery attempt.',
    driverInfo: {
      name: 'Dave M.',
      route: '847',
      timestamp: new Date().toISOString()
    },
    attachments: ['IMG_2847.jpg'],
    location: {
      lat: 40.7128,
      lng: -74.0060,
      address: 'Customer delivery address'
    }
  },
  metadata: {
    source: 'driver_portal',
    priority: 'high',
    scenarioType: 'complex'
  }
};

async function testDeliveryExceptions() {
  console.log('🧪 Testing Triage Agent - Delivery Exception Handling\n');

  // Test 1: Simple delivery exception
  console.log('📦 Test 1: Simple Delivery Exception (Customer Not Home)');
  console.log('Expected: Direct processing by triage agent\n');

  try {
    const simpleResult = await handler(simpleDeliveryException);
    console.log('✅ Simple Exception Result:');
    console.log(JSON.stringify(simpleResult, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Simple Exception Failed:', error.message);
    console.log('\n' + '='.repeat(80) + '\n');
  }

  // Test 2: Complex delivery exception
  console.log('📦 Test 2: Complex Delivery Exception (Damaged Package)');
  console.log('Expected: A2A orchestration with payment, warehouse, and order agents\n');

  try {
    const complexResult = await handler(complexDeliveryException);
    console.log('✅ Complex Exception Result:');
    console.log(JSON.stringify(complexResult, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Complex Exception Failed:', error.message);
    console.log('\n' + '='.repeat(80) + '\n');
  }

  console.log('🎯 Test Summary:');
  console.log('- Simple exceptions should be handled directly by triage agent');
  console.log('- Complex exceptions should trigger A2A orchestration');
  console.log('- Both should include order data loading and classification');
  console.log('- Results should be formatted for frontend consumption');
}

// Run the tests
testDeliveryExceptions().catch(console.error);
