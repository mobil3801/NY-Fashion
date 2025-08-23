
async function uploadInvoiceFile(poId, invoiceData, file) {
  try {
    if (!poId) {
      throw new Error('Purchase Order ID is required');
    }

    if (!invoiceData) {
      throw new Error('Invoice data is required');
    }

    if (!file) {
      throw new Error('Invoice file is required');
    }

    // Validate file type and size
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PDF, images, and Word documents are allowed.');
    }

    if (file.size > maxFileSize) {
      throw new Error('File is too large. Maximum size is 10MB.');
    }

    // Upload file to EasySite storage
    const uploadResult = await window.ezsite.apis.upload({
      filename: `invoice_${poId}_${Date.now()}.${file.name.split('.').pop()}`,
      file: file
    });

    if (uploadResult.error) {
      throw new Error(`Failed to upload file: ${uploadResult.error}`);
    }

    // Get the uploaded file URL
    const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
    if (urlResult.error) {
      throw new Error(`Failed to get file URL: ${urlResult.error}`);
    }

    // Get purchase order details
    const poQuery = `SELECT supplier_id FROM purchase_orders WHERE id = $1`;
    const poResult = await window.ezsite.db.query(poQuery, [parseInt(poId)]);
    
    if (!poResult || poResult.length === 0) {
      throw new Error('Purchase order not found');
    }

    const supplier_id = poResult[0].supplier_id;

    // Save invoice record to database
    const insertQuery = `
      INSERT INTO purchase_order_invoices (
        po_id, supplier_id, invoice_number, invoice_date, due_date, 
        amount, currency, file_url, file_name, file_id, file_size, 
        mime_type, status, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING id, invoice_number, file_url, status
    `;

    const insertResult = await window.ezsite.db.query(insertQuery, [
      parseInt(poId),
      supplier_id,
      invoiceData.invoice_number,
      invoiceData.invoice_date,
      invoiceData.due_date || null,
      parseFloat(invoiceData.amount),
      invoiceData.currency || 'USD',
      urlResult.data,
      file.name,
      uploadResult.data,
      file.size,
      file.type,
      'pending'
    ]);

    if (!insertResult || insertResult.length === 0) {
      throw new Error('Failed to save invoice record');
    }

    return {
      message: 'Invoice uploaded successfully',
      invoice: insertResult[0]
    };

  } catch (error) {
    console.error('Upload invoice file error:', error);
    throw new Error(`Failed to upload invoice: ${error.message}`);
  }
}
