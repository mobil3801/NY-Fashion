
async function getPurchaseOrderInvoices(poId) {
  try {
    if (!poId) {
      throw new Error('Purchase Order ID is required');
    }

    const query = `
      SELECT 
        poi.*,
        s.name as supplier_name,
        po.po_number
      FROM purchase_order_invoices poi
      LEFT JOIN suppliers s ON poi.supplier_id = s.id
      LEFT JOIN purchase_orders po ON poi.po_id = po.id
      WHERE poi.po_id = $1 
      ORDER BY poi.uploaded_at DESC
    `;

    const result = await window.ezsite.db.query(query, [parseInt(poId)]);

    return {
      invoices: result || [],
      count: result?.length || 0
    };

  } catch (error) {
    console.error('Get purchase order invoices error:', error);
    throw new Error(`Failed to get invoices: ${error.message}`);
  }
}