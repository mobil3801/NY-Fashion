
async function getFileInfo(fileId, fileType = 'general') {
  try {
    if (!fileId) {
      throw new Error('File ID is required');
    }

    let query, params;

    switch (fileType) {
      case 'product_image':
        query = `
          SELECT pi.*, p.name as product_name, p.sku
          FROM product_images pi
          LEFT JOIN products p ON pi.product_id = p.id
          WHERE pi.id = $1
        `;
        params = [parseInt(fileId)];
        break;

      case 'employee_photo':
        query = `
          SELECT ep.*, e.first_name, e.last_name, e.employee_id as emp_code
          FROM employee_photos ep
          LEFT JOIN employees e ON ep.employee_id = e.id
          WHERE ep.id = $1
        `;
        params = [parseInt(fileId)];
        break;

      case 'invoice':
        query = `
          SELECT poi.*, po.po_number, s.name as supplier_name
          FROM purchase_order_invoices poi
          LEFT JOIN purchase_orders po ON poi.po_id = po.id
          LEFT JOIN suppliers s ON poi.supplier_id = s.id
          WHERE poi.id = $1
        `;
        params = [parseInt(fileId)];
        break;

      default:
        throw new Error('Invalid file type specified');
    }

    const result = await window.ezsite.db.query(query, params);

    if (!result || result.length === 0) {
      throw new Error('File not found');
    }

    const fileInfo = result[0];

    // Add file metadata
    fileInfo.file_size_formatted = formatFileSize(fileInfo.file_size || 0);
    fileInfo.uploaded_date = new Date(fileInfo.uploaded_at || fileInfo.created_at).toLocaleDateString();

    return fileInfo;

  } catch (error) {
    console.error('Get file info error:', error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}