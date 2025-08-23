
function saveSupplier(supplier) {
  const { Database } = require('sqlite3');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');

  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);

    if (supplier.id) {
      // Update existing supplier
      const query = `
        UPDATE suppliers 
        SET name = ?, contact_person = ?, email = ?, phone = ?, 
            address = ?, city = ?, country = ?, tax_id = ?, 
            payment_terms = ?, credit_limit = ?, currency = ?, 
            status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(query, [
      supplier.name, supplier.contact_person, supplier.email, supplier.phone,
      supplier.address, supplier.city, supplier.country, supplier.tax_id,
      supplier.payment_terms, supplier.credit_limit, supplier.currency,
      supplier.status, supplier.id],
      function (err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve({ id: supplier.id, success: true });
        }
      });
    } else {
      // Create new supplier
      const id = uuidv4();
      const query = `
        INSERT INTO suppliers 
        (id, name, contact_person, email, phone, address, city, country, 
         tax_id, payment_terms, credit_limit, currency, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
      id, supplier.name, supplier.contact_person, supplier.email, supplier.phone,
      supplier.address, supplier.city, supplier.country, supplier.tax_id,
      supplier.payment_terms || '30 days', supplier.credit_limit || 0,
      supplier.currency || 'USD', supplier.status || 'active'],
      function (err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve({ id, success: true });
        }
      });
    }
  });
}

module.exports = saveSupplier;