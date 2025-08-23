
function saveProduct(productData, userId) {
  const {
    id,
    name,
    name_bn,
    description,
    category_id,
    brand,
    sku,
    barcode,
    cost_price,
    selling_price,
    msrp,
    min_stock_level,
    max_stock_level,
    unit,
    weight,
    dimensions,
    has_variants,
    tags,
    variants = [],
    images = []
  } = productData;

  if (id) {
    // Update existing product
    const sql = `
            UPDATE products SET
                name = ?, name_bn = ?, description = ?, category_id = ?,
                brand = ?, sku = ?, barcode = ?, cost_price = ?, selling_price = ?,
                msrp = ?, min_stock_level = ?, max_stock_level = ?, unit = ?,
                weight = ?, dimensions = ?, has_variants = ?, tags = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

    window.ezsite.db.exec(sql, [
    name, name_bn, description, category_id, brand, sku, barcode,
    cost_price, selling_price, msrp, min_stock_level, max_stock_level,
    unit, weight, dimensions, has_variants ? 1 : 0, tags, id]
    );

    // Update variants if product has variants
    if (has_variants && variants.length > 0) {
      // Remove existing variants
      window.ezsite.db.exec('DELETE FROM product_variants WHERE product_id = ?', [id]);

      // Insert new variants
      variants.forEach((variant) => {
        const variantSql = `
                    INSERT INTO product_variants 
                    (product_id, variant_name, sku, barcode, size, color, material,
                     cost_price, selling_price, msrp, current_stock)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

        window.ezsite.db.exec(variantSql, [
        id, variant.variant_name, variant.sku, variant.barcode,
        variant.size, variant.color, variant.material,
        variant.cost_price, variant.selling_price, variant.msrp,
        variant.current_stock || 0]
        );
      });
    }

    return { success: true, id, message: 'Product updated successfully' };
  } else {
    // Insert new product
    const sql = `
            INSERT INTO products 
            (name, name_bn, description, category_id, brand, sku, barcode,
             cost_price, selling_price, msrp, min_stock_level, max_stock_level,
             unit, weight, dimensions, has_variants, tags, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const result = window.ezsite.db.exec(sql, [
    name, name_bn, description, category_id, brand, sku, barcode,
    cost_price, selling_price, msrp, min_stock_level, max_stock_level,
    unit, weight, dimensions, has_variants ? 1 : 0, tags, userId]
    );

    const productId = result.lastInsertRowid;

    // Insert variants if product has variants
    if (has_variants && variants.length > 0) {
      variants.forEach((variant) => {
        const variantSql = `
                    INSERT INTO product_variants 
                    (product_id, variant_name, sku, barcode, size, color, material,
                     cost_price, selling_price, msrp, current_stock)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

        window.ezsite.db.exec(variantSql, [
        productId, variant.variant_name, variant.sku, variant.barcode,
        variant.size, variant.color, variant.material,
        variant.cost_price, variant.selling_price, variant.msrp,
        variant.current_stock || 0]
        );
      });
    } else {
      // Create a default variant for single products
      const variantSql = `
                INSERT INTO product_variants 
                (product_id, variant_name, sku, barcode, cost_price, selling_price, msrp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

      window.ezsite.db.exec(variantSql, [
      productId, 'Default', sku, barcode, cost_price, selling_price, msrp]
      );
    }

    return { success: true, id: productId, message: 'Product created successfully' };
  }
}