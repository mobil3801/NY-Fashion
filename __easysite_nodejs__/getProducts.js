
function getProducts(filters = {}) {
  try {
    let query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.brand,
        p.cost_cents,
        p.price_cents,
        p.tax_exempt,
        p.barcode,
        p.sku,
        p.images,
        c.name as category_name,
        c.id as category_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.search) {
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.description) LIKE LOWER($${paramIndex}) OR
        LOWER(p.sku) LIKE LOWER($${paramIndex}) OR
        LOWER(p.barcode) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.category_id) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(parseInt(filters.category_id));
      paramIndex++;
    }

    if (filters.brand) {
      query += ` AND LOWER(p.brand) LIKE LOWER($${paramIndex})`;
      params.push(`%${filters.brand}%`);
      paramIndex++;
    }

    if (filters.min_price) {
      query += ` AND p.price_cents >= $${paramIndex}`;
      params.push(parseInt(filters.min_price) * 100);
      paramIndex++;
    }

    if (filters.max_price) {
      query += ` AND p.price_cents <= $${paramIndex}`;
      params.push(parseInt(filters.max_price) * 100);
      paramIndex++;
    }

    // Add ordering
    const orderBy = filters.order_by || 'name';
    const orderDir = filters.order_dir === 'desc' ? 'DESC' : 'ASC';

    // Validate order_by to prevent SQL injection
    const validOrderFields = ['name', 'brand', 'price_cents', 'cost_cents', 'created_at'];
    if (validOrderFields.includes(orderBy)) {
      query += ` ORDER BY p.${orderBy} ${orderDir}`;
    } else {
      query += ` ORDER BY p.name ASC`;
    }

    // Add pagination if specified
    if (filters.limit) {
      const limit = parseInt(filters.limit);
      const offset = parseInt(filters.offset) || 0;

      if (limit > 0 && limit <= 1000) {// Reasonable limit
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
      }
    }

    const result = window.ezsite.db.query(query, params);

    if (!result) {
      return [];
    }

    // Format the results
    const products = result.map((product) => ({
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      brand: product.brand || '',
      costCents: parseInt(product.cost_cents) || 0,
      priceCents: parseInt(product.price_cents) || 0,
      cost: Math.round((parseInt(product.cost_cents) || 0) / 100 * 100) / 100,
      price: Math.round((parseInt(product.price_cents) || 0) / 100 * 100) / 100,
      taxExempt: Boolean(product.tax_exempt),
      barcode: product.barcode || '',
      sku: product.sku || '',
      images: product.images ? Array.isArray(product.images) ? product.images : JSON.parse(product.images || '[]') : [],
      categoryName: product.category_name || '',
      categoryId: product.category_id || null
    }));

    return products;

  } catch (error) {
    console.error('Get products error:', error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
}