
async function deleteInvoiceFile(invoiceId) {
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // Get invoice record first
    const selectQuery = `
      SELECT id, po_id, file_id, file_name, status
      FROM purchase_order_invoices 
      WHERE id = $1
    `;
    const invoiceResult = await window.ezsite.db.query(selectQuery, [parseInt(invoiceId)]);

    if (!invoiceResult || invoiceResult.length === 0) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceResult[0];

    // Check if invoice can be deleted (not if it's already processed/paid)
    if (invoice.status === 'paid') {
      throw new Error('Cannot delete paid invoices');
    }

    // Delete file from storage if file ID exists
    if (invoice.file_id) {
      try {




















        // Note: EasySite storage delete API not available yet
        // await window.ezsite.apis.deleteFile(invoice.file_id);
      } catch (error) {console.warn('Could not delete file from storage:', error.message); // Continue with database deletion even if storage deletion fails
      }} // Delete from database
    const deleteQuery = `DELETE FROM purchase_order_invoices WHERE id = $1`;await window.ezsite.db.query(deleteQuery, [parseInt(invoiceId)]);return { message: 'Invoice deleted successfully', deletedInvoiceId: invoiceId, fileName: invoice.file_name };} catch (error) {console.error('Delete invoice file error:', error);throw new Error(`Failed to delete invoice: ${error.message}`);}}