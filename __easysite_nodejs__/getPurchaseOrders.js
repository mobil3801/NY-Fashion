
function getPurchaseOrders() {
  const { Database } = require('sqlite3');
  const path = require('path');
  
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);
    
    // Get all purchase orders with their items
    const query = `
      SELECT 
        po.*,
        poi.id as item_id, poi.product_id, poi.product_name, poi.sku,
        poi.quantity_ordered, poi.quantity_received, poi.quantity_invoiced,
        poi.unit_cost as item_unit_cost, poi.total_cost as item_total_cost,
        poi.description as item_description
      FROM purchase_orders po
      LEFT JOIN po_items poi ON po.id = poi.po_id
      ORDER BY po.created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        // Group items by purchase order
        const poMap = new Map();
        
        rows.forEach(row => {
          if (!poMap.has(row.id)) {
            poMap.set(row.id, {
              id: row.id,
              po_number: row.po_number,
              supplier_id: row.supplier_id,
              supplier_name: row.supplier_name,
              status: row.status,
              order_date: row.order_date,
              expected_date: row.expected_date,
              received_date: row.received_date,
              subtotal: row.subtotal,
              freight_cost: row.freight_cost,
              duty_cost: row.duty_cost,
              other_costs: row.other_costs,
              total_cost: row.total_cost,
              currency: row.currency,
              notes: row.notes,
              created_by: row.created_by,
              approved_by: row.approved_by,
              approved_at: row.approved_at,
              created_at: row.created_at,
              updated_at: row.updated_at,
              items: []
            });
          }
          
          if (row.item_id) {
            poMap.get(row.id).items.push({
              id: row.item_id,
              po_id: row.id,
              product_id: row.product_id,
              product_name: row.product_name,
              sku: row.sku,
              quantity_ordered: row.quantity_ordered,
              quantity_received: row.quantity_received,
              quantity_invoiced: row.quantity_invoiced,
              unit_cost: row.item_unit_cost,
              total_cost: row.item_total_cost,
              description: row.item_description
            });
          }
        });
        
        resolve(Array.from(poMap.values()));
      }
    });
  });
}

module.exports = getPurchaseOrders;
