
function receivePOItems(receiptData) {
  const { Database } = require('sqlite3');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');
  
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);
    
    const receiptId = uuidv4();
    const receiptNumber = 'RCP-' + Date.now().toString().slice(-8);
    
    db.serialize(() => {
      // Create receipt record
      db.run(`
        INSERT INTO po_receipts 
        (id, po_id, receipt_number, received_date, received_by, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        receiptId, receiptData.po_id, receiptNumber, receiptData.received_date,
        receiptData.received_by, receiptData.notes
      ], function(err) {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        // Insert receipt items and update PO items
        const itemPromises = receiptData.items.map(item => {
          return new Promise((itemResolve, itemReject) => {
            // Insert receipt item
            db.run(`
              INSERT INTO po_receipt_items 
              (id, receipt_id, po_item_id, product_id, quantity_received, 
               unit_cost, total_cost, condition, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              uuidv4(), receiptId, item.po_item_id, item.product_id,
              item.quantity_received, item.unit_cost, item.total_cost,
              item.condition || 'good', item.notes
            ], function(err) {
              if (err) {
                itemReject(err);
                return;
              }
              
              // Update PO item quantities
              db.run(`
                UPDATE po_items 
                SET quantity_received = quantity_received + ?
                WHERE id = ?
              `, [item.quantity_received, item.po_item_id], function(err) {
                if (err) {
                  itemReject(err);
                } else {
                  // Update product stock
                  db.run(`
                    UPDATE products 
                    SET quantity = quantity + ?
                    WHERE id = ?
                  `, [item.quantity_received, item.product_id], function(err) {
                    if (err) {
                      itemReject(err);
                    } else {
                      itemResolve();
                    }
                  });
                }
              });
            });
          });
        });
        
        Promise.all(itemPromises)
          .then(() => {
            // Check if PO is fully received
            db.get(`
              SELECT 
                SUM(quantity_ordered) as total_ordered,
                SUM(quantity_received) as total_received
              FROM po_items 
              WHERE po_id = ?
            `, [receiptData.po_id], (err, row) => {
              if (err) {
                db.close();
                reject(err);
                return;
              }
              
              const newStatus = row.total_received >= row.total_ordered ? 'received' : 'partial';
              
              // Update PO status
              db.run(`
                UPDATE purchase_orders 
                SET status = ?, received_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [newStatus, receiptData.received_date, receiptData.po_id], function(err) {
                db.close();
                if (err) {
                  reject(err);
                } else {
                  resolve({ receiptId, receiptNumber, success: true });
                }
              });
            });
          })
          .catch(err => {
            db.close();
            reject(err);
          });
      });
    });
  });
}

module.exports = receivePOItems;
