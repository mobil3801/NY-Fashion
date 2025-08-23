
function saveProduct(productData) {
  try {
    if (!productData) {
      throw new Error('Product data is required');
    }

    const {
      id,
      name,
      description,
      brand,
      category_id,
      cost_cents,
      price_cents,
      tax_exempt,
      barcode,
      sku,
      images
    } = productData;

    // Validate required fields
    if (!name || !category_id) {
      throw new Error('Product name and category are required');
    }

    const costCents = parseInt(cost_cents) || 0;
    const priceCents = parseInt(price_cents) || 0;
    const categoryId = parseInt(category_id);
    const taxExempt = Boolean(tax_exempt);
    const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);

    if (id) {
      // Update existing product
      const query = `
        UPDATE products 
        SET 
          name = $1,
          description = $2,
          brand = $3,
          category_id = $4,
          cost_cents = $5,
          price_cents = $6,
          tax_exempt = $7,
          barcode = $8,
          sku = $9,
          images = $10
        WHERE id = $11
        RETURNING id
      `;

      const result = window.ezsite.db.query(query, [
        name,
        description || '',
        brand || '',
        categoryId,
        costCents,
        priceCents,
        taxExempt,
        barcode || '',
        sku || '',
        imagesJson,
        parseInt(id)
      ]);

      if (!result || result.length === 0) {
        throw new Error('Product not found or could not be updated');
      }

      return { id: parseInt(id), message: 'Product updated successfully' };

    } else {
      // Create new product
      const query = `
        INSERT INTO products (
          name, description, brand, category_id, cost_cents, 
          price_cents, tax_exempt, barcode, sku, images
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const result = window.ezsite.db.query(query, [
        name,
        description || '',
        brand || '',
        categoryId,
        costCents,
        priceCents,
        taxExempt,
        barcode || '',
        sku || '',
        imagesJson
      ]);

      if (!result || result.length === 0) {
        throw new Error('Failed to create product');
      }

      return { id: result[0].id, message: 'Product created successfully' };
    }

  } catch (error) {
    console.error('Save product error:', error);
    throw new Error(`Failed to save product: ${error.message}`);
  }
}
