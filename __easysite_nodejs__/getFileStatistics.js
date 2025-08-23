
async function getFileStatistics() {
  try {
    // Get product images stats
    const productImagesQuery = `
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(file_size), 0) as total_size
      FROM product_images
    `;
    const productImagesResult = await window.ezsite.db.query(productImagesQuery);

    // Get employee photos stats
    const employeePhotosQuery = `
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN front_image_url IS NOT NULL THEN file_size ELSE 0 END), 0) as total_size
      FROM employee_photos
    `;
    const employeePhotosResult = await window.ezsite.db.query(employeePhotosQuery);

    // Get invoice files stats
    const invoicesQuery = `
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(file_size), 0) as total_size
      FROM purchase_order_invoices
    `;
    const invoicesResult = await window.ezsite.db.query(invoicesQuery);

    // Get orphaned files count
    const orphanedProductImagesQuery = `
      SELECT COUNT(*) as count
      FROM product_images pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE p.id IS NULL
    `;
    const orphanedProductImagesResult = await window.ezsite.db.query(orphanedProductImagesQuery);

    const orphanedEmployeePhotosQuery = `
      SELECT COUNT(*) as count
      FROM employee_photos ep
      LEFT JOIN employees e ON ep.employee_id = e.id
      WHERE e.id IS NULL
    `;
    const orphanedEmployeePhotosResult = await window.ezsite.db.query(orphanedEmployeePhotosQuery);

    const orphanedInvoicesQuery = `
      SELECT COUNT(*) as count
      FROM purchase_order_invoices poi
      LEFT JOIN purchase_orders po ON poi.po_id = po.id
      WHERE po.id IS NULL
    `;
    const orphanedInvoicesResult = await window.ezsite.db.query(orphanedInvoicesQuery);

    const productImages = productImagesResult[0] || { count: 0, total_size: 0 };
    const employeePhotos = employeePhotosResult[0] || { count: 0, total_size: 0 };
    const invoices = invoicesResult[0] || { count: 0, total_size: 0 };

    const orphanedCount = 
      (orphanedProductImagesResult[0]?.count || 0) +
      (orphanedEmployeePhotosResult[0]?.count || 0) +
      (orphanedInvoicesResult[0]?.count || 0);

    const totalFiles = parseInt(productImages.count) + parseInt(employeePhotos.count) + parseInt(invoices.count);
    const totalSize = parseInt(productImages.total_size) + parseInt(employeePhotos.total_size) + parseInt(invoices.total_size);

    return {
      summary: {
        totalFiles,
        totalSize,
        orphanedFiles: orphanedCount
      },
      breakdown: {
        productImages: {
          count: parseInt(productImages.count),
          size: parseInt(productImages.total_size)
        },
        employeePhotos: {
          count: parseInt(employeePhotos.count),
          size: parseInt(employeePhotos.total_size)
        },
        invoices: {
          count: parseInt(invoices.count),
          size: parseInt(invoices.total_size)
        }
      },
      orphaned: {
        productImages: orphanedProductImagesResult[0]?.count || 0,
        employeePhotos: orphanedEmployeePhotosResult[0]?.count || 0,
        invoices: orphanedInvoicesResult[0]?.count || 0
      }
    };

  } catch (error) {
    console.error('Get file statistics error:', error);
    throw new Error(`Failed to get file statistics: ${error.message}`);
  }
}
