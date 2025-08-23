
function saveInvoiceFile(invoiceData) {
  const { Database } = require('sqlite3');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');

  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);

    const id = uuidv4();

    db.run(`
      INSERT INTO po_invoices 
      (id, po_id, supplier_id, invoice_number, invoice_date, due_date, 
       amount, currency, file_url, file_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
    id, invoiceData.po_id, invoiceData.supplier_id, invoiceData.invoice_number,
    invoiceData.invoice_date, invoiceData.due_date, invoiceData.amount,
    invoiceData.currency || 'USD', invoiceData.file_url, invoiceData.file_name,
    invoiceData.status || 'pending'],
    function (err) {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve({ id, success: true });
      }
    });
  });
}

module.exports = saveInvoiceFile;