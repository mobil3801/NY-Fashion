
function getCategories(filters = {}) {
  try {
    let query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.bn_name,
        c.tax_exempt,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.search) {
      query += ` AND (
        LOWER(c.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(c.bn_name) LIKE LOWER($${paramIndex}) OR
        LOWER(c.slug) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.tax_exempt !== undefined) {
      query += ` AND c.tax_exempt = $${paramIndex}`;
      params.push(Boolean(filters.tax_exempt));
      paramIndex++;
    }

    // Group by for COUNT to work
    query += ` GROUP BY c.id, c.name, c.slug, c.bn_name, c.tax_exempt`;

    // Add ordering
    const orderBy = filters.order_by || 'name';
    const orderDir = filters.order_dir === 'desc' ? 'DESC' : 'ASC';
    
    // Validate order_by to prevent SQL injection
    const validOrderFields = ['name', 'slug', 'product_count'];
    if (validOrderFields.includes(orderBy)) {
      if (orderBy === 'product_count') {
        query += ` ORDER BY ${orderBy} ${orderDir}`;
      } else {
        query += ` ORDER BY c.${orderBy} ${orderDir}`;
      }
    } else {
      query += ` ORDER BY c.name ASC`;
    }

    // Add pagination if specified
    if (filters.limit) {
      const limit = parseInt(filters.limit);
      const offset = parseInt(filters.offset) || 0;
      
      if (limit > 0 && limit <= 1000) { // Reasonable limit
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
      }
    }

    const result = window.ezsite.db.query(query, params);
    
    if (!result) {
      return [];
    }

    // Format the results
    const categories = result.map(category => ({
      id: category.id,
      name: category.name || '',
      slug: category.slug || '',
      bnName: category.bn_name || '',
      taxExempt: Boolean(category.tax_exempt),
      productCount: parseInt(category.product_count) || 0
    }));

    return categories;
    
  } catch (error) {
    console.error('Get categories error:', error);
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }
}
