import { z } from 'zod';

// Customer persona definitions
const CUSTOMER_PERSONAS = {
  premium: {
    type: 'premium',
    orderFrequency: 'high',
    averageOrderValue: 500,
    registrationDaysAgo: 365,
    totalOrdersRange: [8, 15],
entRange: [2000, 5000]
  },
  standard: {
    type: 'standard',
    orderFrequency: 'medium',
    averageOrderValue: 200,
    registrationDaysAgo: 180,
    totalOrdersRange: [3, 8],
    totalSpentRange: [500, 1500]
  },
  new: {
    type: 'new',
    orderFrequency: 'low',
    averageOrderValue: 150,
    registrationDaysAgo: 30,
    totalOrdersRange: [1, 3],
    totalSpentRange: [100, 400]
  }
};

const CUSTOMER_NAMES = [
  'John Doe', 'Jane Smith', 'Michael Johnson', 'Sarah Williams', 'David Brown',
  'Emily Davis', 'Robert Miller', 'Lisa Wilson', 'Christopher Moore', 'Amanda Taylor'
];

const CITIES = [
  { name: 'New York', state: 'NY', zipBase: 10000 },
  { name: 'Los Angeles', state: 'CA', zipBase: 90000 },
  { name: 'Chicago', state: 'IL', zipBase: 60000 },
  { name: 'Houston', state: 'TX', zipBase: 77000 },
  { name: 'Phoenix', state: 'AZ', zipBase: 85000 }
];

/**
 * Generate realistic customer profiles with proper DynamoDB structure
 * @param {string} tenantId - The tenant identifier
 * @param {number} count - Number of customers to generate
 * @param {string} scenarioType - Type of scenario (full, minimal)
 * @returns {Array} Array of customer objects
 */
export const generateCustomers = (tenantId, count = 5, scenarioType = 'full') => {
  const customers = [];
  const personaTypes = Object.keys(CUSTOMER_PERSONAS);

  for (let i = 0; i < count; i++) {
    const customerId = `CUST-DEMO-${String(i + 1).padStart(3, '0')}`;

    // Distribute personas evenly with premium customers first
    let personaType;
    if (scenarioType === 'minimal') {
      personaType = 'standard';
    } else {
      if (i < 2) personaType = 'premium';
      else if (i < 4) personaType = 'standard';
      else personaType = 'new';
    }

    const persona = CUSTOMER_PERSONAS[personaType];
    const city = CITIES[i % CITIES.length];
    const name = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];

    // Generate realistic registration date based on persona
    const registrationDate = new Date(Date.now() - persona.registrationDaysAgo * 24 * 60 * 60 * 1000);

    // Generate order history based on persona
    const totalOrders = Math.floor(Math.random() * (persona.totalOrdersRange[1] - persona.totalOrdersRange[0] + 1)) + persona.totalOrdersRange[0];
    const totalSpent = Math.floor(Math.random() * (persona.totalSpentRange[1] - persona.totalSpentRange[0] + 1)) + persona.totalSpentRange[0];

    const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

    const customer = {
      pk: `${tenantId}#customers`,
      sk: `customer#${customerId}`,
      GSI1PK: `${tenantId}#customers`,
      GSI1SK: `${registrationDate.toISOString()}#${customerId}`,
      customerId,
      name,
      email: `${name.toLowerCase().replace(' ', '.')}@email.com`,
      phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
      address: {
        street: `${100 + i * 10} ${name.split(' ')[1]} Street`,
        city: city.name,
        state: city.state,
        zipCode: String(city.zipBase + i),
        country: 'USA'
      },
      customerType: persona.type,
      registrationDate: registrationDate.toISOString(),
      totalOrders,
      totalSpent,
      preferences: {
        communicationMethod: i % 2 === 0 ? 'email' : 'phone',
        deliveryInstructions: persona.type === 'premium' ? 'Signature required' : 'Leave at door'
      },
      ttl
    };

    customers.push(customer);
  }

  return customers;
};

/**
 * Generate a single customer with specific persona
 * @param {string} tenantId - The tenant identifier
 * @param {number} index - Customer index for unique IDs
 * @param {string} personaType - Type of customer persona (premium, standard, new)
 * @returns {Object} Customer object
 */
export const generateCustomerWithPersona = (tenantId, index, personaType = 'standard') => {
  const customers = generateCustomers(tenantId, 1, 'custom');
  const customer = customers[0];

  // Override with specific persona
  const persona = CUSTOMER_PERSONAS[personaType];
  const customerId = `CUST-DEMO-${String(index).padStart(3, '0')}`;
  const registrationDate = new Date(Date.now() - persona.registrationDaysAgo * 24 * 60 * 60 * 1000);

  return {
    ...customer,
    customerId,
    sk: `customer#${customerId}`,
    GSI1SK: `${registrationDate.toISOString()}#${customerId}`,
    customerType: persona.type,
    registrationDate: registrationDate.toISOString(),
    totalOrders: Math.floor(Math.random() * (persona.totalOrdersRange[1] - persona.totalOrdersRange[0] + 1)) + persona.totalOrdersRange[0],
    totalSpent: Math.floor(Math.random() * (persona.totalSpentRange[1] - persona.totalSpentRange[0] + 1)) + persona.totalSpentRange[0]
  };
};

/**
 * Validate customer data structure
 * @param {Object} customer - Customer object to validate
 * @returns {Object} Validated customer object
 */
export const validateCustomerData = (customer) => {
  const customerSchema = z.object({
    pk: z.string(),
    sk: z.string(),
    GSI1PK: z.string(),
    GSI1SK: z.string(),
    customerId: z.string(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string()
    }),
    customerType: z.enum(['premium', 'standard', 'new']),
    registrationDate: z.string(),
    totalOrders: z.number().min(0),
    totalSpent: z.number().min(0),
    preferences: z.object({
      communicationMethod: z.enum(['email', 'phone']),
      deliveryInstructions: z.string()
    }),
    ttl: z.number()
  });

  return customerSchema.parse(customer);
};
// Order status definitions with realistic progression
const ORDER_STATUSES = {
  pending: {
    name: 'pending',
    weight: 0.15,
    nextStatuses: ['processing', 'cancelled'],
    daysFromOrder: 0
  },
  processing: {
    name: 'proc
  weight: 0.20,
    nextStatuses: ['shipped', 'cancelled'],
    daysFromOrder: 1
  },
  shipped: {
    name: 'shipped',
    weight: 0.25,
    nextStatuses: ['delivered', 'exception'],
    daysFromOrder: 3
  },
  delivered: {
    name: 'delivered',
    weight: 0.35,
    nextStatuses: [],
    daysFromOrder: 5
  },
  cancelled: {
    name: 'cancelled',
    weight: 0.05,
    nextStatuses: [],
    daysFromOrder: 1
  }
};

const PRODUCT_CATALOG = [
  { name: 'Premium Wireless Headphones', sku: 'SKU-DEMO-001', price: 299.99, category: 'electronics' },
  { name: 'Smart Fitness Watch', sku: 'SKU-DEMO-002', price: 249.99, category: 'electronics' },
  { name: 'Organic Cotton T-Shirt', sku: 'SKU-DEMO-003', price: 29.99, category: 'clothing' },
  { name: 'Professional Laptop Bag', sku: 'SKU-DEMO-004', price: 89.99, category: 'accessories' },
  { name: 'Bluetooth Speaker', sku: 'SKU-DEMO-005', price: 79.99, category: 'electronics' },
  { name: 'Running Shoes', sku: 'SKU-DEMO-006', price: 129.99, category: 'footwear' },
  { name: 'Coffee Maker', sku: 'SKU-DEMO-007', price: 199.99, category: 'home' },
  { name: 'Yoga Mat', sku: 'SKU-DEMO-008', price: 39.99, category: 'fitness' },
  { name: 'Wireless Mouse', sku: 'SKU-DEMO-009', price: 49.99, category: 'electronics' },
  { name: 'Water Bottle', sku: 'SKU-DEMO-010', price: 24.99, category: 'accessories' }
];

/**
 * Generate orders in various states with proper relationships
 * @param {string} tenantId - The tenant identifier
 * @param {Array} customers - Array of customer objects to link orders to
 * @param {number} count - Number of orders to generate
 * @param {string} scenarioType - Type of scenario (full, minimal)
 * @returns {Array} Array of order objects
 */
export const generateOrders = (tenantId, customers, count = 15, scenarioType = 'full') => {
  const orders = [];
  const statusKeys = Object.keys(ORDER_STATUSES);

  for (let i = 0; i < count; i++) {
    const orderId = `ORD-DEMO-${String(i + 1).padStart(3, '0')}`;

    // Select customer (prefer premium customers for higher value orders)
    const customer = customers[i % customers.length];

    // Select status based on weights for realistic distribution
    let selectedStatus;
    if (scenarioType === 'minimal') {
      selectedStatus = i === 0 ? 'delivered' : 'pending';
    } else {
      const random = Math.random();
      let cumulativeWeight = 0;
      for (const status of statusKeys) {
        cumulativeWeight += ORDER_STATUSES[status].weight;
        if (random <= cumulativeWeight) {
          selectedStatus = status;
          break;
        }
      }
    }

    const statusInfo = ORDER_STATUSES[selectedStatus];

    // Generate order date based on status progression
    const orderDate = new Date(Date.now() - (statusInfo.daysFromOrder + Math.random() * 10) * 24 * 60 * 60 * 1000);

    // Generate items based on customer type
    const itemCount = customer.customerType === 'premium' ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 2) + 1;
    const items = [];
    let totalAmount = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = PRODUCT_CATALOG[Math.floor(Math.random() * PRODUCT_CATALOG.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const itemTotal = product.price * quantity;

      items.push({
        sku: product.sku,
        name: product.name,
        quantity,
        price: product.price,
        total: Math.round(itemTotal * 100) / 100
      });

      totalAmount += itemTotal;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    // Generate status history
    const statusHistory = generateOrderStatusHistory(orderDate, selectedStatus);

    // Calculate delivery date if delivered
    let deliveryDate = null;
    if (selectedStatus === 'delivered') {
      deliveryDate = new Date(orderDate.getTime() + statusInfo.daysFromOrder * 24 * 60 * 60 * 1000);
    }

    const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

    const order = {
      pk: `${tenantId}#orders`,
      sk: `order#${orderId}`,
      GSI1PK: `${tenantId}#orders#${selectedStatus}`,
      GSI1SK: `${orderDate.toISOString()}#${orderId}`,
      orderId,
      customerId: customer.customerId,
      status: selectedStatus,
      items,
      totalAmount,
      currency: 'USD',
      shippingAddress: customer.address,
      orderDate: orderDate.toISOString(),
      deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
      trackingNumber: `TRK-${orderId}`,
      paymentId: `PAY-DEMO-${String(i + 1).padStart(3, '0')}`,
      statusHistory,
      shippingMethod: customer.customerType === 'premium' ? 'express' : 'standard',
      notes: generateOrderNotes(selectedStatus, customer.customerType),
      ttl
    };

    orders.push(order);
  }

  return orders;
};

/**
 * Generate realistic status history for an order
 * @param {Date} orderDate - The original order date
 * @param {string} finalStatus - The final status of the order
 * @returns {Array} Array of status history entries
 */
const generateOrderStatusHistory = (orderDate, finalStatus) => {
  const history = [];
  let currentDate = new Date(orderDate);

  // Always start with pending
  history.push({
    status: 'pending',
    timestamp: currentDate.toISOString(),
    notes: 'Order placed and payment confirmed'
  });

  // Progress through statuses based on final status
  if (finalStatus === 'cancelled') {
    // Cancelled orders might skip processing
    if (Math.random() > 0.5) {
      currentDate = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
      history.push({
        status: 'processing',
        timestamp: currentDate.toISOString(),
        notes: 'Order processing started'
      });
    }

    currentDate = new Date(currentDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours later
    history.push({
      status: 'cancelled',
      timestamp: currentDate.toISOString(),
      notes: 'Order cancelled by customer request'
    });
  } else if (finalStatus !== 'pending') {
    // Processing
    currentDate = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000);
    history.push({
      status: 'processing',
      timestamp: currentDate.toISOString(),
      notes: 'Order processing started'
    });

    if (finalStatus !== 'processing') {
      // Shipped
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      history.push({
        status: 'shipped',
        timestamp: currentDate.toISOString(),
        notes: 'Package shipped from warehouse'
      });

      if (finalStatus === 'delivered') {
        // Delivered
        currentDate = new Date(currentDate.getTime() + 48 * 60 * 60 * 1000);
        history.push({
          status: 'delivered',
          timestamp: currentDate.toISOString(),
          notes: 'Package delivered successfully'
        });
      }
    }
  }

  return history;
};

/**
 * Generate contextual notes for orders
 * @param {string} status - Order status
 * @param {string} customerType - Customer type
 * @returns {string} Order notes
 */
const generateOrderNotes = (status, customerType) => {
  const notesByStatus = {
    pending: 'Awaiting payment confirmation',
    processing: 'Items being prepared for shipment',
    shipped: customerType === 'premium' ? 'Express shipping - signature required' : 'Standard shipping',
    delivered: 'Successfully delivered to customer',
    cancelled: 'Cancelled per customer request'
  };

  return notesByStatus[status] || '';
};

/**
 * Generate orders for specific demo scenarios
 * @param {string} tenantId - The tenant identifier
 * @param {Array} customers - Array of customer objects
 * @param {string} scenarioType - Type of scenario (simple_delivery, complex_delivery, mixed)
 * @returns {Array} Array of scenario-specific orders
 */
export const generateScenarioOrders = (tenantId, customers, scenarioType) => {
  switch (scenarioType) {
    case 'simple_delivery':
      return [generateSimpleDeliveryOrder(tenantId, customers[0])];

    case 'complex_delivery':
      return [generateComplexDeliveryOrder(tenantId, customers[0])];

    case 'mixed':
      return generateOrders(tenantId, customers, 15, 'full');

    default:
      return generateOrders(tenantId, customers, 5, 'minimal');
  }
};

/**
 * Generate a simple delivery scenario order
 * @param {string} tenantId - The tenant identifier
 * @param {Object} customer - Customer object
 * @returns {Object} Order object for simple delivery scenario
 */
const generateSimpleDeliveryOrder = (tenantId, customer) => {
  const orderId = 'ORD-DEMO-SIMPLE';
  const orderDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  return {
    pk: `${tenantId}#orders`,
    sk: `order#${orderId}`,
    GSI1PK: `${tenantId}#orders#out_for_delivery`,
    GSI1SK: `${orderDate.toISOString()}#${orderId}`,
    orderId,
    customerId: customer.customerId,
    status: 'out_for_delivery',
    items: [{
      sku: 'SKU-DEMO-001',
      name: 'Premium Wireless Headphones',
      quantity: 1,
      price: 299.99,
      total: 299.99
    }],
    totalAmount: 299.99,
    currency: 'USD',
    shippingAddress: customer.address,
    orderDate: orderDate.toISOString(),
    deliveryDate: null,
    trackingNumber: 'TRK-ORD-DEMO-SIMPLE',
    paymentId: 'PAY-DEMO-SIMPLE',
    statusHistory: [
      {
        status: 'pending',
        timestamp: orderDate.toISOString(),
        notes: 'Order placed'
      },
      {
        status: 'out_for_delivery',
        timestamp: new Date(orderDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Package out for delivery'
      }
    ],
    shippingMethod: 'standard',
    notes: 'Ready for delivery exception demo',
    ttl
  };
};

/**
 * Generate a complex delivery scenario order
 * @param {string} tenantId - The tenant identifier
 * @param {Object} customer - Customer object
 * @returns {Object} Order object for complex delivery scenario
 */
const generateComplexDeliveryOrder = (tenantId, customer) => {
  const orderId = 'ORD-DEMO-COMPLEX';
  const orderDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
  const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  return {
    pk: `${tenantId}#orders`,
    sk: `order#${orderId}`,
    GSI1PK: `${tenantId}#orders#exception`,
    GSI1SK: `${orderDate.toISOString()}#${orderId}`,
    orderId,
    customerId: customer.customerId,
    status: 'exception',
    items: [
      {
        sku: 'SKU-DEMO-002',
        name: 'Smart Fitness Watch',
        quantity: 1,
        price: 249.99,
        total: 249.99
      },
      {
        sku: 'SKU-DEMO-004',
        name: 'Professional Laptop Bag',
        quantity: 1,
        price: 89.99,
        total: 89.99
      }
    ],
    totalAmount: 339.98,
    currency: 'USD',
    shippingAddress: customer.address,
    orderDate: orderDate.toISOString(),
    deliveryDate: null,
    trackingNumber: 'TRK-ORD-DEMO-COMPLEX',
    paymentId: 'PAY-DEMO-COMPLEX',
    statusHistory: [
      {
        status: 'pending',
        timestamp: orderDate.toISOString(),
        notes: 'Order placed'
      },
      {
        status: 'shipped',
        timestamp: new Date(orderDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Package shipped'
      },
      {
        status: 'exception',
        timestamp: new Date(orderDate.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        notes: 'Package damaged during transit - requires replacement'
      }
    ],
    shippingMethod: 'express',
    notes: 'High-value order requiring special handling',
    exceptionType: 'damaged_package',
    requiresReplacement: true,
    ttl
  };
};

/**
 * Validate order data structure
 * @param {Object} order - Order object to validate
 * @returns {Object} Validated order object
 */
export const validateOrderData = (order) => {
  const orderSchema = z.object({
    pk: z.string(),
    sk: z.string(),
    GSI1PK: z.string(),
    GSI1SK: z.string(),
    orderId: z.string(),
    customerId: z.string(),
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'out_for_delivery', 'exception']),
    items: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      quantity: z.number().min(1),
      price: z.number().min(0),
      total: z.number().min(0)
    })),
    totalAmount: z.number().min(0),
    currency: z.string(),
    shippingAddress: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string()
    }),
    orderDate: z.string(),
    deliveryDate: z.string().nullable(),
    trackingNumber: z.string(),
    paymentId: z.string(),
    statusHistory: z.array(z.object({
      status: z.string(),
      timestamp: z.string(),
      notes: z.string()
    })),
    shippingMethod: z.enum(['standard', 'express']),
    notes: z.string(),
    ttl: z.number()
  });

  return orderSchema.parse(order);
};
// Warehouse and supplier definitions
const WAREHOUSES = [
  { id: 'WH-NYC-001', name: 'New York Distriter', location: 'New York, NY' },
  { id: 'WH-LAX-001', name: 'Los Angeles Fulfillment Center', location: 'Los Angeles, CA' },
  { id: 'WH-CHI-001', name: 'Chicago Logistics Hub', location: 'Chicago, IL' },
  { id: 'WH-DFW-001', name: 'Dallas Distribution Center', location: 'Dallas, TX' }
];

const SUPPLIERS = [
  'TechCorp Industries',
  'Global Electronics Ltd',
  'Premium Goods Inc',
  'Quality Manufacturing Co',
  'Innovative Products LLC'
];

// Stock level scenarios for realistic inventory
const STOCK_SCENARIOS = {
  high_stock: { min: 50, max: 200, reserved: 0.05 },
  medium_stock: { min: 20, max: 50, reserved: 0.10 },
  low_stock: { min: 5, max: 20, reserved: 0.15 },
  critical_stock: { min: 1, max: 5, reserved: 0.20 },
  out_of_stock: { min: 0, max: 0, reserved: 0 }
};

/**
 * Generate product catalog with varying stock levels
 * @param {string} tenantId - The tenant identifier
 * @param {number} count - Number of products to generate
 * @param {string} scenarioType - Type of scenario (full, minimal)
 * @returns {Array} Array of product/inventory objects
 */
export const generateProducts = (tenantId, count = 10, scenarioType = 'full') => {
  const products = [];
  const stockScenarioKeys = Object.keys(STOCK_SCENARIOS);

  for (let i = 0; i < count; i++) {
    const product = PRODUCT_CATALOG[i % PRODUCT_CATALOG.length];
    const warehouse = WAREHOUSES[i % WAREHOUSES.length];
    const supplier = SUPPLIERS[i % SUPPLIERS.length];

    // Distribute stock scenarios realistically
    let stockScenario;
    if (scenarioType === 'minimal') {
      stockScenario = 'medium_stock';
    } else {
      // 40% high stock, 30% medium, 20% low, 8% critical, 2% out of stock
      const random = Math.random();
      if (random < 0.40) stockScenario = 'high_stock';
      else if (random < 0.70) stockScenario = 'medium_stock';
      else if (random < 0.90) stockScenario = 'low_stock';
      else if (random < 0.98) stockScenario = 'critical_stock';
      else stockScenario = 'out_of_stock';
    }

    const stockInfo = STOCK_SCENARIOS[stockScenario];
    const stockLevel = Math.floor(Math.random() * (stockInfo.max - stockInfo.min + 1)) + stockInfo.min;
    const reservedStock = Math.floor(stockLevel * stockInfo.reserved);
    const availableStock = Math.max(0, stockLevel - reservedStock);

    // Generate last restock date (within last 30 days for active products)
    const lastRestocked = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

    const productRecord = {
      pk: `${tenantId}#inventory`,
      sk: `product#${product.sku}`,
      GSI1PK: `${tenantId}#inventory#${availableStock > 0 ? 'available' : 'unavailable'}`,
      GSI1SK: `${product.category}#${product.sku}`,
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: product.price,
      currency: 'USD',
      stockLevel,
      reservedStock,
      availableStock,
      warehouse: warehouse.id,
      warehouseName: warehouse.name,
      warehouseLocation: warehouse.location,
      supplier,
      lastRestocked: lastRestocked.toISOString(),
      reorderPoint: Math.max(5, Math.floor(stockLevel * 0.2)),
      reorderQuantity: Math.floor(stockLevel * 1.5),
      unitCost: Math.round(product.price * 0.6 * 100) / 100, // 40% markup
      weight: generateProductWeight(product.category),
      dimensions: generateProductDimensions(product.category),
      description: generateProductDescription(product.name, product.category),
      tags: generateProductTags(product.category),
      ttl
    };

    products.push(productRecord);
  }

  return products;
};

/**
 * Generate realistic product weight based on category
 * @param {string} category - Product category
 * @returns {Object} Weight object with value and unit
 */
const generateProductWeight = (category) => {
  const weightRanges = {
    electronics: { min: 0.2, max: 2.5 },
    clothing: { min: 0.1, max: 1.0 },
    accessories: { min: 0.1, max: 0.8 },
    footwear: { min: 0.5, max: 1.5 },
    home: { min: 1.0, max: 5.0 },
    fitness: { min: 0.3, max: 2.0 }
  };

  const range = weightRanges[category] || { min: 0.5, max: 2.0 };
  const weight = Math.random() * (range.max - range.min) + range.min;

  return {
    value: Math.round(weight * 100) / 100,
    unit: 'kg'
  };
};

/**
 * Generate realistic product dimensions based on category
 * @param {string} category - Product category
 * @returns {Object} Dimensions object with length, width, height
 */
const generateProductDimensions = (category) => {
  const dimensionRanges = {
    electronics: { l: [10, 30], w: [8, 25], h: [3, 15] },
    clothing: { l: [25, 40], w: [20, 35], h: [2, 5] },
    accessories: { l: [15, 35], w: [10, 25], h: [3, 10] },
    footwear: { l: [25, 35], w: [15, 20], h: [8, 12] },
    home: { l: [20, 50], w: [15, 40], h: [10, 30] },
    fitness: { l: [50, 180], w: [5, 60], h: [2, 10] }
  };

  const ranges = dimensionRanges[category] || { l: [20, 40], w: [15, 30], h: [5, 15] };

  return {
    length: Math.floor(Math.random() * (ranges.l[1] - ranges.l[0] + 1)) + ranges.l[0],
    width: Math.floor(Math.random() * (ranges.w[1] - ranges.w[0] + 1)) + ranges.w[0],
    height: Math.floor(Math.random() * (ranges.h[1] - ranges.h[0] + 1)) + ranges.h[0],
    unit: 'cm'
  };
};

/**
 * Generate product description
 * @param {string} name - Product name
 * @param {string} category - Product category
 * @returns {string} Product description
 */
const generateProductDescription = (name, category) => {
  const descriptions = {
    electronics: `High-quality ${name.toLowerCase()} featuring advanced technology and reliable performance. Perfect for everyday use with premium build quality.`,
    clothing: `Comfortable and stylish ${name.toLowerCase()} made from premium materials. Designed for both comfort and durability.`,
    accessories: `Essential ${name.toLowerCase()} that combines functionality with modern design. A must-have accessory for daily use.`,
    footwear: `Premium ${name.toLowerCase()} designed for comfort and style. Features advanced materials and ergonomic design.`,
    home: `Quality ${name.toLowerCase()} that enhances your home experience. Built to last with attention to detail.`,
    fitness: `Professional-grade ${name.toLowerCase()} designed for optimal performance. Perfect for fitness enthusiasts and professionals.`
  };

  return descriptions[category] || `Quality ${name.toLowerCase()} designed for reliability and performance.`;
};

/**
 * Generate product tags based on category
 * @param {string} category - Product category
 * @returns {Array} Array of product tags
 */
const generateProductTags = (category) => {
  const tagsByCategory = {
    electronics: ['tech', 'gadget', 'wireless', 'premium'],
    clothing: ['fashion', 'comfortable', 'casual', 'organic'],
    accessories: ['essential', 'portable', 'professional', 'durable'],
    footwear: ['comfortable', 'athletic', 'performance', 'style'],
    home: ['kitchen', 'appliance', 'convenience', 'modern'],
    fitness: ['workout', 'health', 'exercise', 'portable']
  };

  const baseTags = tagsByCategory[category] || ['quality', 'reliable'];
  const commonTags = ['bestseller', 'popular', 'recommended'];

  // Randomly select 2-4 tags
  const selectedTags = [...baseTags];
  if (Math.random() > 0.5) {
    selectedTags.push(commonTags[Math.floor(Math.random() * commonTags.length)]);
  }

  return selectedTags.slice(0, 4);
};

/**
 * Generate inventory for specific demo scenarios
 * @param {string} tenantId - The tenant identifier
 * @param {string} scenarioType - Type of scenario
 * @returns {Array} Array of scenario-specific inventory
 */
export const generateScenarioInventory = (tenantId, scenarioType) => {
  switch (scenarioType) {
    case 'low_stock_alert':
      return generateLowStockScenario(tenantId);

    case 'out_of_stock':
      return generateOutOfStockScenario(tenantId);

    case 'restock_needed':
      return generateRestockScenario(tenantId);

    default:
      return generateProducts(tenantId, 10, 'full');
  }
};

/**
 * Generate low stock scenario inventory
 * @param {string} tenantId - The tenant identifier
 * @returns {Array} Array of low stock products
 */
const generateLowStockScenario = (tenantId) => {
  const products = generateProducts(tenantId, 5, 'minimal');

  // Force low stock levels
  return products.map((product, index) => {
    const stockLevel = Math.floor(Math.random() * 5) + 1; // 1-5 items
    const reservedStock = Math.floor(stockLevel * 0.5);
    const availableStock = stockLevel - reservedStock;

    return {
      ...product,
      stockLevel,
      reservedStock,
      availableStock,
      GSI1PK: `${tenantId}#inventory#${availableStock > 0 ? 'low_stock' : 'unavailable'}`,
      reorderPoint: stockLevel + 5 // Trigger reorder alert
    };
  });
};

/**
 * Generate out of stock scenario inventory
 * @param {string} tenantId - The tenant identifier
 * @returns {Array} Array with some out of stock products
 */
const generateOutOfStockScenario = (tenantId) => {
  const products = generateProducts(tenantId, 3, 'minimal');

  // Force out of stock for first product
  products[0] = {
    ...products[0],
    stockLevel: 0,
    reservedStock: 0,
    availableStock: 0,
    GSI1PK: `${tenantId}#inventory#unavailable`
  };

  return products;
};

/**
 * Generate restock scenario inventory
 * @param {string} tenantId - The tenant identifier
 * @returns {Array} Array of products needing restock
 */
const generateRestockScenario = (tenantId) => {
  const products = generateProducts(tenantId, 4, 'minimal');

  // Set stock levels below reorder points
  return products.map(product => {
    const reorderPoint = 10;
    const stockLevel = Math.floor(Math.random() * 5) + 2; // 2-6 items (below reorder point)
    const reservedStock = Math.floor(stockLevel * 0.3);
    const availableStock = stockLevel - reservedStock;

    return {
      ...product,
      stockLevel,
      reservedStock,
      availableStock,
      reorderPoint,
      GSI1PK: `${tenantId}#inventory#restock_needed`
    };
  });
};

/**
 * Update inventory levels after order processing
 * @param {Array} products - Array of product objects
 * @param {Array} orders - Array of order objects
 * @returns {Array} Updated product array with adjusted stock levels
 */
export const updateInventoryFromOrders = (products, orders) => {
  const productMap = new Map(products.map(p => [p.sku, { ...p }]));

  // Process each order to update inventory
  orders.forEach(order => {
    if (order.status !== 'cancelled') {
      order.items.forEach(item => {
        const product = productMap.get(item.sku);
        if (product) {
          // Reserve stock for non-delivered orders
          if (['pending', 'processing', 'shipped'].includes(order.status)) {
            product.reservedStock = Math.min(
              product.stockLevel,
              product.reservedStock + item.quantity
            );
          }

          // Reduce available stock for shipped/delivered orders
          if (['shipped', 'delivered'].includes(order.status)) {
            product.stockLevel = Math.max(0, product.stockLevel - item.quantity);
            product.reservedStock = Math.max(0, product.reservedStock - item.quantity);
          }

          product.availableStock = Math.max(0, product.stockLevel - product.reservedStock);

          // Update GSI1PK based on availability
          product.GSI1PK = `${product.pk.split('#')[0]}#inventory#${product.availableStock > 0 ? 'available' : 'unavailable'}`;
        }
      });
    }
  });

  return Array.from(productMap.values());
};

/**
 * Validate product/inventory data structure
 * @param {Object} product - Product object to validate
 * @returns {Object} Validated product object
 */
export const validateProductData = (product) => {
  const productSchema = z.object({
    pk: z.string(),
    sk: z.string(),
    GSI1PK: z.string(),
    GSI1SK: z.string(),
    sku: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number().min(0),
    currency: z.string(),
    stockLevel: z.number().min(0),
    reservedStock: z.number().min(0),
    availableStock: z.number().min(0),
    warehouse: z.string(),
    warehouseName: z.string(),
    warehouseLocation: z.string(),
    supplier: z.string(),
    lastRestocked: z.string(),
    reorderPoint: z.number().min(0),
    reorderQuantity: z.number().min(0),
    unitCost: z.number().min(0),
    weight: z.object({
      value: z.number().min(0),
      unit: z.string()
    }),
    dimensions: z.object({
      length: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0),
      unit: z.string()
    }),
    description: z.string(),
    tags: z.array(z.string()),
    ttl: z.number()
  });

  return productSchema.parse(product);
};
// Payment method definitions
const PAYMENT_METHODS = {
  credit_card: {
    name:t_card',
    displayName: 'Credit Card',
    processingTime: 0, // Instant
    failureRate: 0.02,
    refundTime: 3 // 3 days
  },
  debit_card: {
    name: 'debit_card',
    displayName: 'Debit Card',
    processingTime: 0,
    failureRate: 0.01,
    refundTime: 1
  },
  paypal: {
    name: 'paypal',
    displayName: 'PayPal',
    processingTime: 5, // 5 minutes
    failureRate: 0.03,
    refundTime: 2
  },
  bank_transfer: {
    name: 'bank_transfer',
    displayName: 'Bank Transfer',
    processingTime: 60, // 1 hour
    failureRate: 0.05,
    refundTime: 5
  }
};

// Payment status definitions with realistic progression
const PAYMENT_STATUSES = {
  pending: {
    name: 'pending',
    weight: 0.10,
    nextStatuses: ['processing', 'failed'],
    isTerminal: false
  },
  processing: {
    name: 'processing',
    weight: 0.05,
    nextStatuses: ['completed', 'failed'],
    isTerminal: false
  },
  completed: {
    name: 'completed',
    weight: 0.80,
    nextStatuses: ['refunded', 'partially_refunded'],
    isTerminal: true
  },
  failed: {
    name: 'failed',
    weight: 0.03,
    nextStatuses: [],
    isTerminal: true
  },
  refunded: {
    name: 'refunded',
    weight: 0.015,
    nextStatuses: [],
    isTerminal: true
  },
  partially_refunded: {
    name: 'partially_refunded',
    weight: 0.005,
    nextStatuses: ['refunded'],
    isTerminal: false
  }
};

/**
 * Generate payment records linked to orders
 * @param {string} tenantId - The tenant identifier
 * @param {Array} orders - Array of order objects to link payments to
 * @param {string} scenarioType - Type of scenario (full, minimal)
 * @returns {Array} Array of payment objects
 */
export const generatePayments = (tenantId, orders, scenarioType = 'full') => {
  const payments = [];
  const paymentMethodKeys = Object.keys(PAYMENT_METHODS);
  const statusKeys = Object.keys(PAYMENT_STATUSES);

  orders.forEach((order, index) => {
    const paymentId = order.paymentId;

    // Select payment method based on customer type and order value
    let paymentMethod;
    if (order.totalAmount > 300) {
      // High-value orders prefer credit cards
      paymentMethod = Math.random() > 0.3 ? 'credit_card' : paymentMethodKeys[Math.floor(Math.random() * paymentMethodKeys.length)];
    } else {
      paymentMethod = paymentMethodKeys[Math.floor(Math.random() * paymentMethodKeys.length)];
    }

    const methodInfo = PAYMENT_METHODS[paymentMethod];

    // Determine payment status based on order status and weights
    let paymentStatus;
    if (order.status === 'cancelled') {
      paymentStatus = Math.random() > 0.5 ? 'refunded' : 'failed';
    } else if (order.status === 'pending') {
      paymentStatus = 'pending';
    } else {
      // Use weighted selection for other statuses
      const random = Math.random();
      let cumulativeWeight = 0;
      for (const status of statusKeys) {
        cumulativeWeight += PAYMENT_STATUSES[status].weight;
        if (random <= cumulativeWeight) {
          paymentStatus = status;
          break;
        }
      }
    }

    // Calculate processing time based on payment method
    const orderDate = new Date(order.orderDate);
    const processedAt = new Date(orderDate.getTime() + methodInfo.processingTime * 60 * 1000);

    // Generate transaction details
    const transactionId = `TXN-${paymentId.replace('PAY-', '')}`;

    // Calculate refund amount if applicable
    let refundAmount = 0;
    if (paymentStatus === 'refunded') {
      refundAmount = order.totalAmount;
    } else if (paymentStatus === 'partially_refunded') {
      refundAmount = Math.round((order.totalAmount * (0.1 + Math.random() * 0.4)) * 100) / 100; // 10-50% refund
    }

    const ttl = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

    const payment = {
      pk: `${tenantId}#payments`,
      sk: `payment#${paymentId}`,
      GSI1PK: `${tenantId}#payments#${paymentStatus}`,
      GSI1SK: `${processedAt.toISOString()}#${paymentId}`,
      paymentId,
      orderId: order.orderId,
      customerId: order.customerId,
      amount: order.totalAmount,
      currency: order.currency,
      paymentMethod,
      paymentMethodDisplay: methodInfo.displayName,
      status: paymentStatus,
      transactionId,
      processedAt: processedAt.toISOString(),
      refundAmount,
      fees: calculatePaymentFees(order.totalAmount, paymentMethod),
      gateway: generatePaymentGateway(paymentMethod),
      authorizationCode: generateAuthCode(),
      billingAddress: generateBillingAddress(order.shippingAddress),
      paymentHistory: generatePaymentHistory(orderDate, paymentStatus, methodInfo),
      riskScore: generateRiskScore(order.totalAmount, paymentMethod),
      metadata: {
        ipAddress: generateRandomIP(),
        userAgent: 'SwiftShip-Demo-Client/1.0',
        deviceFingerprint: generateDeviceFingerprint()
      },
      ttl
    };

    payments.push(payment);
  });

  return payments;
};

/**
 * Calculate payment processing fees
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Object} Fee breakdown
 */
const calculatePaymentFees = (amount, paymentMethod) => {
  const feeRates = {
    credit_card: 0.029, // 2.9%
    debit_card: 0.015,  // 1.5%
    paypal: 0.034,      // 3.4%
    bank_transfer: 0.005 // 0.5%
  };

  const rate = feeRates[paymentMethod] || 0.025;
  const processingFee = Math.round(amount * rate * 100) / 100;
  const fixedFee = paymentMethod === 'credit_card' ? 0.30 : 0;

  return {
    processingFee,
    fixedFee,
    totalFees: Math.round((processingFee + fixedFee) * 100) / 100
  };
};

/**
 * Generate payment gateway information
 * @param {string} paymentMethod - Payment method
 * @returns {Object} Gateway information
 */
const generatePaymentGateway = (paymentMethod) => {
  const gateways = {
    credit_card: { name: 'Stripe', processor: 'stripe' },
    debit_card: { name: 'Stripe', processor: 'stripe' },
    paypal: { name: 'PayPal', processor: 'paypal' },
    bank_transfer: { name: 'Plaid', processor: 'plaid' }
  };

  return gateways[paymentMethod] || { name: 'Generic Gateway', processor: 'generic' };
};

/**
 * Generate authorization code
 * @returns {string} Authorization code
 */
const generateAuthCode = () => {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
};

/**
 * Generate billing address (usually same as shipping)
 * @param {Object} shippingAddress - Shipping address object
 * @returns {Object} Billing address object
 */
const generateBillingAddress = (shippingAddress) => {
  // 80% of the time, billing address matches shipping address
  if (Math.random() < 0.8) {
    return { ...shippingAddress };
  }

  // 20% of the time, generate different billing address
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];
  const cityIndex = Math.floor(Math.random() * cities.length);

  return {
    street: `${Math.floor(Math.random() * 9999) + 1} Billing Street`,
    city: cities[cityIndex],
    state: states[cityIndex],
    zipCode: String(10000 + Math.floor(Math.random() * 89999)),
    country: 'USA'
  };
};

/**
 * Generate payment history with status transitions
 * @param {Date} orderDate - Original order date
 * @param {string} finalStatus - Final payment status
 * @param {Object} methodInfo - Payment method information
 * @returns {Array} Payment history array
 */
const generatePaymentHistory = (orderDate, finalStatus, methodInfo) => {
  const history = [];
  let currentDate = new Date(orderDate);

  // Initial payment attempt
  history.push({
    status: 'pending',
    timestamp: currentDate.toISOString(),
    notes: 'Payment initiated',
    amount: null
  });

  // Processing phase
  if (finalStatus !== 'failed') {
    currentDate = new Date(currentDate.getTime() + methodInfo.processingTime * 60 * 1000);
    history.push({
      status: 'processing',
      timestamp: currentDate.toISOString(),
      notes: `Processing via ${methodInfo.displayName}`,
      amount: null
    });

    // Completion
    if (finalStatus !== 'processing') {
      currentDate = new Date(currentDate.getTime() + 2 * 60 * 1000); // 2 minutes later
      history.push({
        status: 'completed',
        timestamp: currentDate.toISOString(),
        notes: 'Payment completed successfully',
        amount: null
      });

      // Refund if applicable
      if (finalStatus.includes('refund')) {
        currentDate = new Date(currentDate.getTime() + methodInfo.refundTime * 24 * 60 * 60 * 1000);
        history.push({
          status: finalStatus,
          timestamp: currentDate.toISOString(),
          notes: finalStatus === 'refunded' ? 'Full refund processed' : 'Partial refund processed',
          amount: finalStatus === 'refunded' ? 'full' : 'partial'
        });
      }
    }
  } else {
    // Failed payment
    currentDate = new Date(currentDate.getTime() + 5 * 60 * 1000); // 5 minutes later
    history.push({
      status: 'failed',
      timestamp: currentDate.toISOString(),
      notes: 'Payment failed - insufficient funds',
      amount: null
    });
  }

  return history;
};

/**
 * Generate risk score for fraud detection
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Object} Risk assessment
 */
const generateRiskScore = (amount, paymentMethod) => {
  let baseScore = Math.random() * 30; // Base score 0-30

  // Adjust based on amount
  if (amount > 500) baseScore += 10;
  if (amount > 1000) baseScore += 15;

  // Adjust based on payment method
  const methodRisk = {
    credit_card: 5,
    debit_card: 3,
    paypal: 8,
    bank_transfer: 2
  };

  baseScore += methodRisk[paymentMethod] || 5;

  const finalScore = Math.min(100, Math.round(baseScore));

  return {
    score: finalScore,
    level: finalScore < 30 ? 'low' : finalScore < 60 ? 'medium' : 'high',
    factors: generateRiskFactors(finalScore)
  };
};

/**
 * Generate risk factors based on score
 * @param {number} score - Risk score
 * @returns {Array} Array of risk factors
 */
const generateRiskFactors = (score) => {
  const factors = [];

  if (score > 50) factors.push('High transaction amount');
  if (score > 40) factors.push('New customer');
  if (score > 60) factors.push('Unusual payment pattern');
  if (score < 20) factors.push('Verified customer');
  if (score < 30) factors.push('Standard transaction amount');

  return factors.slice(0, 3); // Return max 3 factors
};

/**
 * Generate random IP address
 * @returns {string} IP address
 */
const generateRandomIP = () => {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
};

/**
 * Generate device fingerprint
 * @returns {string} Device fingerprint
 */
const generateDeviceFingerprint = () => {
  return Math.random().toString(36).substr(2, 16);
};

/**
 * Generate payments for specific demo scenarios
 * @param {string} tenantId - The tenant identifier
 * @param {Array} orders - Array of order objects
 * @param {string} scenarioType - Type of scenario
 * @returns {Array} Array of scenario-specific payments
 */
export const generateScenarioPayments = (tenantId, orders, scenarioType) => {
  switch (scenarioType) {
    case 'failed_payments':
      return generateFailedPaymentScenario(tenantId, orders);

    case 'refund_processing':
      return generateRefundScenario(tenantId, orders);

    case 'high_risk':
      return generateHighRiskScenario(tenantId, orders);

    default:
      return generatePayments(tenantId, orders, 'full');
  }
};

/**
 * Generate failed payment scenario
 * @param {string} tenantId - The tenant identifier
 * @param {Array} orders - Array of order objects
 * @returns {Array} Array of payments with failures
 */
const generateFailedPaymentScenario = (tenantId, orders) => {
  const payments = generatePayments(tenantId, orders, 'full');

  // Force first payment to fail
  if (payments.length > 0) {
    payments[0] = {
      ...payments[0],
      status: 'failed',
      GSI1PK: `${tenantId}#payments#failed`,
      paymentHistory: [
        {
          status: 'pending',
          timestamp: payments[0].processedAt,
          notes: 'Payment initiated',
          amount: null
        },
        {
          status: 'failed',
          timestamp: new Date(new Date(payments[0].processedAt).getTime() + 5 * 60 * 1000).toISOString(),
          notes: 'Payment failed - card declined',
          amount: null
        }
      ]
    };
  }

  return payments;
};

/**
 * Generate refund processing scenario
 * @param {string} tenantId - The tenant identifier
 * @param {Array} orders - Array of order objects
 * @returns {Array} Array of payments with refunds
 */
const generateRefundScenario = (tenantId, orders) => {
  const payments = generatePayments(tenantId, orders, 'full');

  // Force first payment to be refunded
  if (payments.length > 0) {
    const refundAmount = payments[0].amount;
    payments[0] = {
      ...payments[0],
      status: 'refunded',
      refundAmount,
      GSI1PK: `${tenantId}#payments#refunded`
    };
  }

  return payments;
};

/**
 * Generate high risk payment scenario
 * @param {string} tenantId - The tenant identifier
 * @param {Array} orders - Array of order objects
 * @returns {Array} Array of high-risk payments
 */
const generateHighRiskScenario = (tenantId, orders) => {
  const payments = generatePayments(tenantId, orders, 'full');

  // Force high risk scores
  return payments.map(payment => ({
    ...payment,
    riskScore: {
      score: 75 + Math.floor(Math.random() * 25), // 75-100
      level: 'high',
      factors: ['High transaction amount', 'Unusual payment pattern', 'New customer']
    }
  }));
};

/**
 * Validate payment data structure
 * @param {Object} payment - Payment object to validate
 * @returns {Object} Validated payment object
 */
export const validatePaymentData = (payment) => {
  const paymentSchema = z.object({
    pk: z.string(),
    sk: z.string(),
    GSI1PK: z.string(),
    GSI1SK: z.string(),
    paymentId: z.string(),
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number().min(0),
    currency: z.string(),
    paymentMethod: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
    paymentMethodDisplay: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded']),
    transactionId: z.string(),
    processedAt: z.string(),
    refundAmount: z.number().min(0),
    fees: z.object({
      processingFee: z.number().min(0),
      fixedFee: z.number().min(0),
      totalFees: z.number().min(0)
    }),
    gateway: z.object({
      name: z.string(),
      processor: z.string()
    }),
    authorizationCode: z.string(),
    billingAddress: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string()
    }),
    paymentHistory: z.array(z.object({
      status: z.string(),
      timestamp: z.string(),
      notes: z.string(),
      amount: z.union([z.string(), z.null()])
    })),
    riskScore: z.object({
      score: z.number().min(0).max(100),
      level: z.enum(['low', 'medium', 'high']),
      factors: z.array(z.string())
    }),
    metadata: z.object({
      ipAddress: z.string(),
      userAgent: z.string(),
      deviceFingerprint: z.string()
    }),
    ttl: z.number()
  });

  return paymentSchema.parse(payment);
};
