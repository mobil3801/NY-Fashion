
function getCustomers(filters = {}) {
  try {
    let query = `
      SELECT 
        id,
        name,
        phone,
        email,
        notes,
        created_by
      FROM customers
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.search) {
      query += ` AND (
        LOWER(name) LIKE LOWER($${paramIndex}) OR 
        LOWER(phone) LIKE LOWER($${paramIndex}) OR
        LOWER(email) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.phone) {
      query += ` AND phone = $${paramIndex}`;
      params.push(filters.phone);
      paramIndex++;
    }

    // Add ordering
    const orderBy = filters.order_by || 'name';
    const orderDir = filters.order_dir === 'desc' ? 'DESC' : 'ASC';
    
    // Validate order_by to prevent SQL injection
    const validOrderFields = ['name', 'phone', 'email', 'created_at'];
    if (validOrderFields.includes(orderBy)) {
      query += ` ORDER BY ${orderBy} ${orderDir}`;
    } else {
      query += ` ORDER BY name ASC`;
    }

    // Add pagination if specified
    if (filters.limit) {
      const limit = parseInt(filters.limit);
      const offset = parseInt(filters.offset) || 0;
      
      if (limit > 0 && limit <= 1000) {
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
      }
    }

    const result = window.ezsite.db.query(query, params);
    
    if (!result) {
      return [];
    }

    // Format the results
    const customers = result.map(customer => ({
      id: customer.id,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
      createdBy: customer.created_by || null
    }));

    return customers;
    
  } catch (error) {
    console.error('Get customers error:', error);
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }
}
