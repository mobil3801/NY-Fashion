
function getLowStockProducts(filters = {}) {
  try {
    // For this demo, we'll simulate low stock products by querying products
    // In a real system, you'd have stock tables and proper inventory tracking
    
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
        c.id as category_id,
        -- Simulated stock levels for demo
        (CASE 
          WHEN p.id % 5 = 0 THEN 0  -- Out of stock
          WHEN p.id % 5 = 1 THEN 2  -- Low stock
          WHEN p.id % 5 = 2 THEN 1  -- Critical stock
          WHEN p.id % 5 = 3 THEN 8  -- Good stock (filtered out)
          ELSE 15  -- High stock (filtered out)
        END) as current_stock,
        5 as min_stock_level,
        20 as max_stock_level,
        'pcs' as unit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Add search filter if provided
    if (filters.search) {
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.sku) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Filter for low stock only (current_stock <= min_stock_level)
    query += ` HAVING current_stock <= min_stock_level`;
    
    // Order by stock level (most critical first)
    query += ` ORDER BY current_stock ASC, p.name ASC`;

    // Limit results for performance
    const limit = parseInt(filters.limit) || 50;
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const result = window.ezsite.db.query(query, params);

    if (!result) {
      return [];
    }

    // Format the results
    const lowStockProducts = result.map((product) => ({
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      brand: product.brand || '',
      category_id: product.category_id,
      category_name: product.category_name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      unit: product.unit || 'pcs',
      
      // Stock information
      total_stock: parseInt(product.current_stock) || 0,
      min_stock_level: parseInt(product.min_stock_level) || 5,
      max_stock_level: parseInt(product.max_stock_level) || 20,
      
      // Pricing
      cost_price: Math.round((parseInt(product.cost_cents) || 0) / 100 * 100) / 100,
      selling_price: Math.round((parseInt(product.price_cents) || 0) / 100 * 100) / 100,
      cost_cents: parseInt(product.cost_cents) || 0,
      price_cents: parseInt(product.price_cents) || 0,
      
      // Other attributes
      tax_exempt: Boolean(product.tax_exempt),
      images: product.images ? 
        (Array.isArray(product.images) ? 
          product.images : 
          JSON.parse(product.images || '[]')) : 
        []
    }));

    return lowStockProducts;

  } catch (error) {
    console.error('Get low stock products error:', error);
    throw new Error(`Failed to fetch low stock products: ${error.message}`);
  }
}
