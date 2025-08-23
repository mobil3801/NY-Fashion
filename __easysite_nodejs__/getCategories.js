
function getCategories() {
  const sql = `
        SELECT 
            c.*,
            COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.name ASC
    `;

  const categories = window.ezsite.db.prepare(sql).all();
  return { categories };
}