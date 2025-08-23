
function searchProducts(searchTerm, limit = 20) {
  try {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return [];
    }

    const query = `
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.price_cents,
        p.barcode,
        p.sku,
        p.images,
        c.name as category_name,
        pv.id as variant_id,
        pv.size,
        pv.color,
        pv.additional_sku,
        pv.barcode as variant_barcode,
        pv.price_override_cents,
        COALESCE(il.qty_on_hand, 0) as stock_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.active = true
      LEFT JOIN inventory_lots il ON pv.id = il.variant_id
      WHERE (
        LOWER(p.name) LIKE LOWER($1) OR 
        LOWER(p.brand) LIKE LOWER($1) OR
        LOWER(p.sku) LIKE LOWER($1) OR
        LOWER(p.barcode) LIKE LOWER($1) OR
        LOWER(pv.additional_sku) LIKE LOWER($1) OR
        LOWER(pv.barcode) LIKE LOWER($1)
      )
      ORDER BY 
        CASE 
          WHEN LOWER(p.name) = LOWER($2) THEN 1
          WHEN LOWER(p.sku) = LOWER($2) THEN 2
          WHEN LOWER(p.barcode) = LOWER($2) THEN 3
          WHEN LOWER(pv.barcode) = LOWER($2) THEN 4
          ELSE 5
        END,
        p.name ASC
      LIMIT $3
    `;

    const searchPattern = `%${searchTerm}%`;
    const exactTerm = searchTerm.trim();
    const limitInt = Math.min(parseInt(limit) || 20, 100); // Cap at 100 results

    const result = window.ezsite.db.query(query, [searchPattern, exactTerm, limitInt]);
    
    if (!result || !Array.isArray(result)) {
      return [];
    }

    // Format the results
    const products = result.map(row => {
      const basePrice = parseInt(row.price_override_cents) || parseInt(row.price_cents) || 0;
      const images = row.images ? (Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]')) : [];
      
      return {
        id: row.id,
        variantId: row.variant_id || null,
        name: row.name || '',
        brand: row.brand || '',
        categoryName: row.category_name || '',
        size: row.size || '',
        color: row.color || '',
        sku: row.sku || '',
        barcode: row.barcode || '',
        variantSku: row.additional_sku || '',
        variantBarcode: row.variant_barcode || '',
        priceCents: basePrice,
        price: Math.round(basePrice / 100 * 100) / 100,
        stockQuantity: parseInt(row.stock_quantity) || 0,
        images: images,
        displayName: `${row.name || ''} ${row.size ? `(${row.size})` : ''} ${row.color ? `[${row.color}]` : ''}`.trim()
      };
    });

    return products;
    
  } catch (error) {
    console.error('Search products error:', error);
    throw new Error(`Failed to search products: ${error.message}`);
  }
}
