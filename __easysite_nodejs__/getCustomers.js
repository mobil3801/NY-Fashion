
function getCustomers(query = '') {
  // Mock customer data - replace with actual database queries
  const mockCustomers = [
  {
    id: 'cust-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-0123',
    loyaltyNumber: 'LOYAL001',
    discountRate: 5,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'cust-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1-555-0124',
    loyaltyNumber: 'LOYAL002',
    discountRate: 10,
    createdAt: '2024-01-02T00:00:00Z'
  },
  {
    id: 'cust-3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    phone: '+1-555-0125',
    loyaltyNumber: 'LOYAL003',
    discountRate: 0,
    createdAt: '2024-01-03T00:00:00Z'
  }];


  if (!query) {
    return mockCustomers;
  }

  return mockCustomers.filter((customer) =>
  customer.name.toLowerCase().includes(query.toLowerCase()) ||
  customer.email?.toLowerCase().includes(query.toLowerCase()) ||
  customer.phone?.includes(query) ||
  customer.loyaltyNumber?.toLowerCase().includes(query.toLowerCase())
  );
}