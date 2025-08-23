
function getProducts(filters = {}) {
  const {
    page = 1,
    limit = 50,
    category_id,
    search,
    low_stock_only = false,
    active_only = true
  } = filters;

  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (active_only) {
    whereClause += ' AND p.is_active = 1';
  }

  if (category_id) {
    whereClause += ' AND p.category_id = ?';
    params.push(category_id);
  }

  if (search) {
    whereClause += ' AND (p.name LIKE ? OR p.name_bn LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const sql = `
        SELECT 
            p.*,
            c.name as category_name,
            c.name_bn as category_name_bn,
            COALESCE(SUM(pv.current_stock), 0) as total_stock,
            COUNT(pv.id) as variant_count,
            (
                SELECT image_url 
                FROM product_images pi 
                WHERE pi.product_id = p.id AND pi.is_primary = 1 
                LIMIT 1
            ) as primary_image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.is_active = 1
        ${whereClause}
        GROUP BY p.id
        ${low_stock_only ? 'HAVING total_stock <= p.min_stock_level' : ''}
        ORDER BY p.updated_at DESC
        LIMIT ? OFFSET ?
    `;

  params.push(limit, offset);

  const products = window.ezsite.db.prepare(sql).all(...params);

  // Get total count
  const countSql = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
    `;

  const countParams = params.slice(0, -2); // Remove limit and offset
  const { total } = window.ezsite.db.prepare(countSql).get(...countParams);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}