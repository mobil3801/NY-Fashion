
async function cleanupOrphanedFiles() {
  try {
    let cleanupCount = 0;
    const cleanupResults = [];

    // Clean up orphaned product images
    const orphanedProductImagesQuery = `
      SELECT pi.id, pi.file_id, pi.image_url 
      FROM product_images pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE p.id IS NULL
    `;

    const orphanedProductImages = await window.ezsite.db.query(orphanedProductImagesQuery);

    for (const image of orphanedProductImages) {
      try {
        // Note: EasySite storage delete API not available yet
        // if (image.file_id) {
        //   await window.ezsite.apis.deleteFile(image.file_id);
        // }

        await window.ezsite.db.query('DELETE FROM product_images WHERE id = $1', [image.id]);
        cleanupCount++;
        cleanupResults.push({ type: 'product_image', id: image.id, status: 'deleted' });
      } catch (error) {
        cleanupResults.push({ type: 'product_image', id: image.id, status: 'error', error: error.message });
      }
    }

    // Clean up orphaned employee photos
    const orphanedEmployeePhotosQuery = `
      SELECT ep.id, ep.front_file_id, ep.back_file_id 
      FROM employee_photos ep
      LEFT JOIN employees e ON ep.employee_id = e.id
      WHERE e.id IS NULL
    `;

    const orphanedEmployeePhotos = await window.ezsite.db.query(orphanedEmployeePhotosQuery);

    for (const photo of orphanedEmployeePhotos) {
      try {
        // Note: EasySite storage delete API not available yet
        // if (photo.front_file_id) {
        //   await window.ezsite.apis.deleteFile(photo.front_file_id);
        // }
        // if (photo.back_file_id) {
        //   await window.ezsite.apis.deleteFile(photo.back_file_id);
        // }

        await window.ezsite.db.query('DELETE FROM employee_photos WHERE id = $1', [photo.id]);
        cleanupCount++;
        cleanupResults.push({ type: 'employee_photo', id: photo.id, status: 'deleted' });
      } catch (error) {
        cleanupResults.push({ type: 'employee_photo', id: photo.id, status: 'error', error: error.message });
      }
    }

    // Clean up orphaned purchase order invoices
    const orphanedInvoicesQuery = `
      SELECT poi.id, poi.file_id 
      FROM purchase_order_invoices poi
      LEFT JOIN purchase_orders po ON poi.po_id = po.id
      WHERE po.id IS NULL
    `;

    const orphanedInvoices = await window.ezsite.db.query(orphanedInvoicesQuery);

    for (const invoice of orphanedInvoices) {
      try {
        // Note: EasySite storage delete API not available yet
        // if (invoice.file_id) {
        //   await window.ezsite.apis.deleteFile(invoice.file_id);
        // }

        await window.ezsite.db.query('DELETE FROM purchase_order_invoices WHERE id = $1', [invoice.id]);
        cleanupCount++;
        cleanupResults.push({ type: 'invoice', id: invoice.id, status: 'deleted' });
      } catch (error) {
        cleanupResults.push({ type: 'invoice', id: invoice.id, status: 'error', error: error.message });
      }
    }

    return {
      message: `Cleanup completed. ${cleanupCount} orphaned files removed.`,
      cleanupCount,
      results: cleanupResults
    };

  } catch (error) {
    console.error('File cleanup error:', error);
    throw new Error(`Failed to cleanup files: ${error.message}`);
  }
}