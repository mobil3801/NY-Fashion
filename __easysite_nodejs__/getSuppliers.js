
function getSuppliers() {
  const { Database } = require('sqlite3');
  const path = require('path');

  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);

    db.all('SELECT * FROM suppliers ORDER BY name', [], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

module.exports = getSuppliers;