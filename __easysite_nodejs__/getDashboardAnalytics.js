
function getDashboardAnalytics(dateRange = 'today') {
  try {
    const now = new Date();
    let startDate, endDate;

    // Calculate date range
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // Get total sales for the period
    const salesQuery = `
      SELECT 
        COALESCE(COUNT(*), 0) as total_transactions,
        COALESCE(SUM(total_cents), 0) as total_sales_cents,
        COALESCE(AVG(total_cents), 0) as avg_basket_cents
      FROM sales 
      WHERE status = 'sale' 
        AND created_at >= $1 
        AND created_at < $2
    `;

    const salesResult = window.ezsite.db.query(salesQuery, [startISO, endISO]);
    const salesData = salesResult.length > 0 ? salesResult[0] : {
      total_transactions: 0,
      total_sales_cents: 0,
      avg_basket_cents: 0
    };

    // Get returns count
    const returnsQuery = `
      SELECT COALESCE(COUNT(*), 0) as total_returns
      FROM returns 
      WHERE created_at >= $1 AND created_at < $2
    `;

    const returnsResult = window.ezsite.db.query(returnsQuery, [startISO, endISO]);
    const returnsCount = returnsResult.length > 0 ? returnsResult[0].total_returns : 0;

    // Get payment method breakdown
    const paymentQuery = `
      SELECT 
        payment_method,
        COALESCE(COUNT(*), 0) as count,
        COALESCE(SUM(total_cents), 0) as total_cents
      FROM sales 
      WHERE status = 'sale' 
        AND created_at >= $1 
        AND created_at < $2
      GROUP BY payment_method
    `;

    const paymentResult = window.ezsite.db.query(paymentQuery, [startISO, endISO]);
    const paymentMethods = paymentResult || [];

    // Get top products
    const topProductsQuery = `
      SELECT 
        p.name,
        SUM(si.qty) as quantity_sold,
        SUM(si.qty * si.unit_price_cents) as revenue_cents
      FROM sale_items si
      JOIN product_variants pv ON si.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'sale' 
        AND s.created_at >= $1 
        AND s.created_at < $2
      GROUP BY p.id, p.name
      ORDER BY quantity_sold DESC
      LIMIT 5
    `;

    const topProductsResult = window.ezsite.db.query(topProductsQuery, [startISO, endISO]);
    const topProducts = topProductsResult || [];

    // Get top categories
    const topCategoriesQuery = `
      SELECT 
        c.name,
        SUM(si.qty) as quantity_sold,
        SUM(si.qty * si.unit_price_cents) as revenue_cents
      FROM sale_items si
      JOIN product_variants pv ON si.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'sale' 
        AND s.created_at >= $1 
        AND s.created_at < $2
      GROUP BY c.id, c.name
      ORDER BY quantity_sold DESC
      LIMIT 5
    `;

    const topCategoriesResult = window.ezsite.db.query(topCategoriesQuery, [startISO, endISO]);
    const topCategories = topCategoriesResult || [];

    // Get employee performance (if employee data exists)
    const employeeQuery = `
      SELECT 
        e.name,
        COALESCE(COUNT(s.id), 0) as sales_count,
        COALESCE(SUM(s.total_cents), 0) as sales_total_cents
      FROM employees e
      LEFT JOIN sales s ON s.created_by = e.user_id 
        AND s.status = 'sale' 
        AND s.created_at >= $1 
        AND s.created_at < $2
      WHERE e.status = 'active'
      GROUP BY e.id, e.name
      ORDER BY sales_total_cents DESC
      LIMIT 5
    `;

    const employeeResult = window.ezsite.db.query(employeeQuery, [startISO, endISO]);
    const topEmployees = employeeResult || [];

    // Get low stock alerts
    const lowStockQuery = `
      SELECT 
        p.name,
        pv.size,
        pv.color,
        COALESCE(il.qty_on_hand, 0) as stock_level
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN inventory_lots il ON pv.id = il.variant_id
      WHERE pv.active = true 
        AND COALESCE(il.qty_on_hand, 0) <= 10
      ORDER BY COALESCE(il.qty_on_hand, 0) ASC
      LIMIT 10
    `;

    const lowStockResult = window.ezsite.db.query(lowStockQuery, []);
    const lowStockItems = lowStockResult || [];

    // Calculate return rate
    const totalTransactions = parseInt(salesData.total_transactions) || 0;
    const totalReturns = parseInt(returnsCount) || 0;
    const returnRate = totalTransactions > 0 ? totalReturns / totalTransactions * 100 : 0;

    // Format response
    const analytics = {
      summary: {
        totalSales: Math.round((parseInt(salesData.total_sales_cents) || 0) / 100),
        totalTransactions: totalTransactions,
        averageBasket: Math.round((parseInt(salesData.avg_basket_cents) || 0) / 100),
        returnRate: Math.round(returnRate * 100) / 100
      },
      paymentMethods: paymentMethods.map((pm) => ({
        method: pm.payment_method,
        count: parseInt(pm.count) || 0,
        total: Math.round((parseInt(pm.total_cents) || 0) / 100)
      })),
      topProducts: topProducts.map((tp) => ({
        name: tp.name,
        quantitySold: parseInt(tp.quantity_sold) || 0,
        revenue: Math.round((parseInt(tp.revenue_cents) || 0) / 100)
      })),
      topCategories: topCategories.map((tc) => ({
        name: tc.name,
        quantitySold: parseInt(tc.quantity_sold) || 0,
        revenue: Math.round((parseInt(tc.revenue_cents) || 0) / 100)
      })),
      topEmployees: topEmployees.map((te) => ({
        name: te.name,
        salesCount: parseInt(te.sales_count) || 0,
        salesTotal: Math.round((parseInt(te.sales_total_cents) || 0) / 100)
      })),
      lowStockItems: lowStockItems.map((lsi) => ({
        name: lsi.name,
        variant: `${lsi.size || ''} ${lsi.color || ''}`.trim(),
        stockLevel: parseInt(lsi.stock_level) || 0
      }))
    };

    return analytics;

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    throw new Error(`Failed to fetch dashboard analytics: ${error.message}`);
  }
}