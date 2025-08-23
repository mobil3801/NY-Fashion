
function savePurchaseOrder(purchaseOrder) {
  const { Database } = require('sqlite3');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');
  
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);
    
    const id = purchaseOrder.id || uuidv4();
    
    db.serialize(() => {
      if (purchaseOrder.id) {
        // Update existing PO
        db.run(`
          UPDATE purchase_orders 
          SET supplier_id = ?, supplier_name = ?, status = ?, order_date = ?,
              expected_date = ?, subtotal = ?, freight_cost = ?, duty_cost = ?,
              other_costs = ?, total_cost = ?, currency = ?, notes = ?,
              approved_by = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          purchaseOrder.supplier_id, purchaseOrder.supplier_name, purchaseOrder.status,
          purchaseOrder.order_date, purchaseOrder.expected_date, purchaseOrder.subtotal,
          purchaseOrder.freight_cost, purchaseOrder.duty_cost, purchaseOrder.other_costs,
          purchaseOrder.total_cost, purchaseOrder.currency, purchaseOrder.notes,
          purchaseOrder.approved_by, purchaseOrder.approved_at, purchaseOrder.id
        ], function(err) {
          if (err) {
            db.close();
            reject(err);
            return;
          }
          
          // Delete existing items and insert new ones
          db.run('DELETE FROM po_items WHERE po_id = ?', [purchaseOrder.id], function(err) {
            if (err) {
              db.close();
              reject(err);
              return;
            }
            
            insertItems();
          });
        });
      } else {
        // Generate PO number
        const poNumber = 'PO-' + Date.now().toString().slice(-8);
        
        // Create new PO
        db.run(`
          INSERT INTO purchase_orders 
          (id, po_number, supplier_id, supplier_name, status, order_date, expected_date,
           subtotal, freight_cost, duty_cost, other_costs, total_cost, currency,
           notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, poNumber, purchaseOrder.supplier_id, purchaseOrder.supplier_name,
          purchaseOrder.status || 'draft', purchaseOrder.order_date, purchaseOrder.expected_date,
          purchaseOrder.subtotal, purchaseOrder.freight_cost, purchaseOrder.duty_cost,
          purchaseOrder.other_costs, purchaseOrder.total_cost, purchaseOrder.currency || 'USD',
          purchaseOrder.notes, purchaseOrder.created_by
        ], function(err) {
          if (err) {
            db.close();
            reject(err);
            return;
          }
          
          insertItems();
        });
      }
      
      function insertItems() {
        if (purchaseOrder.items && purchaseOrder.items.length > 0) {
          const itemPromises = purchaseOrder.items.map(item => {
            const itemId = item.id || uuidv4();
            return new Promise((itemResolve, itemReject) => {
              db.run(`
                INSERT INTO po_items 
                (id, po_id, product_id, product_name, sku, quantity_ordered,
                 quantity_received, quantity_invoiced, unit_cost, total_cost, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                itemId, id, item.product_id, item.product_name, item.sku,
                item.quantity_ordered, item.quantity_received || 0,
                item.quantity_invoiced || 0, item.unit_cost, item.total_cost,
                item.description
              ], function(err) {
                if (err) itemReject(err);
                else itemResolve();
              });
            });
          });
          
          Promise.all(itemPromises)
            .then(() => {
              db.close();
              resolve({ id, success: true });
            })
            .catch(err => {
              db.close();
              reject(err);
            });
        } else {
          db.close();
          resolve({ id, success: true });
        }
      }
    });
  });
}

module.exports = savePurchaseOrder;
