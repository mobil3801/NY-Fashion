
async function updateInvoiceStatus(invoiceId, status, notes = null) {
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    if (!status) {
      throw new Error('Status is required');
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'paid'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update invoice status
    const updateQuery = `
      UPDATE purchase_order_invoices 
      SET 
        status = $1,
        status_notes = $2,
        status_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, invoice_number, status, status_updated_at
    `;

    const result = await window.ezsite.db.query(updateQuery, [
      status,
      notes,
      parseInt(invoiceId)
    ]);

    if (!result || result.length === 0) {
      throw new Error('Invoice not found');
    }

    // Log the status change
    const logQuery = `
      INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        user_id,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    await window.ezsite.db.query(logQuery, [
      'purchase_order_invoices',
      parseInt(invoiceId),
      'status_update',
      JSON.stringify({ status: 'previous_status' }),
      JSON.stringify({ status, notes }),
      null // User ID would come from session in real implementation
    ]);

    return {
      message: `Invoice status updated to ${status}`,
      invoice: result[0]
    };

  } catch (error) {
    console.error('Update invoice status error:', error);
    throw new Error(`Failed to update invoice status: ${error.message}`);
  }
}
