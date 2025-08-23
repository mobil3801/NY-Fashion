
function updatePOStatus(poId, status, userId, options = {}) {
  const { Database } = require('sqlite3');
  const path = require('path');

  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);

    let updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    let updateValues = [status];

    // Handle approval
    if (status === 'sent' && options.approve) {
      updateFields.push('approved_by = ?', 'approved_at = CURRENT_TIMESTAMP');
      updateValues.push(userId);
    }

    // Handle receiving
    if (status === 'received' || status === 'partial') {
      updateFields.push('received_date = ?');
      updateValues.push(options.receivedDate || new Date().toISOString().split('T')[0]);
    }

    updateValues.push(poId);

    const query = `UPDATE purchase_orders SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(query, updateValues, function (err) {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
}

module.exports = updatePOStatus;