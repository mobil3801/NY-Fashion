
function getPOInvoices(poId) {
  const { Database } = require('sqlite3');
  const path = require('path');

  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);

    const query = poId ?
    'SELECT * FROM po_invoices WHERE po_id = ? ORDER BY created_at DESC' :
    'SELECT * FROM po_invoices ORDER BY created_at DESC';

    const params = poId ? [poId] : [];

    db.all(query, params, (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

module.exports = getPOInvoices;