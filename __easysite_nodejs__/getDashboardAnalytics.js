
function getDashboardAnalytics(dateRange, previousPeriod = false) {
  const { startDate, endDate } = dateRange;

  // Convert dates to proper format
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate previous period dates for comparison
  const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - periodDays);
  const prevEnd = new Date(start);
  prevEnd.setDate(start.getDate() - 1);

  const analytics = {
    kpis: {},
    charts: {},
    trends: {},
    comparison: {}
  };

  try {
    // Today's Sales Revenue
    const salesQuery = `
      SELECT 
        COALESCE(SUM(total_cents), 0) as total_revenue,
        COUNT(*) as transaction_count,
        COALESCE(AVG(total_cents), 0) as avg_basket_value
      FROM sales 
      WHERE created_at >= $1 AND created_at <= $2 
      AND status = 'sale'
    `;

    const salesResult = window.ezsite.db.query(salesQuery, [start.toISOString(), end.toISOString()]);
    analytics.kpis.todaySales = salesResult.rows[0];

    // Previous period comparison
    if (previousPeriod) {
      const prevSalesResult = window.ezsite.db.query(salesQuery, [prevStart.toISOString(), prevEnd.toISOString()]);
      analytics.comparison.previousSales = prevSalesResult.rows[0];
    }

    // Gross Margin Calculation
    const marginQuery = `
      SELECT 
        COALESCE(SUM(si.qty * si.unit_price_cents), 0) as total_revenue,
        COALESCE(SUM(si.qty * si.unit_cost_cents), 0) as total_cost
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= $1 AND s.created_at <= $2 
      AND s.status = 'sale'
    `;

    const marginResult = window.ezsite.db.query(marginQuery, [start.toISOString(), end.toISOString()]);
    const marginData = marginResult.rows[0];
    analytics.kpis.grossMargin = {
      revenue: marginData.total_revenue,
      cost: marginData.total_cost,
      margin: marginData.total_revenue > 0 ? (marginData.total_revenue - marginData.total_cost) / marginData.total_revenue * 100 : 0
    };

    // Top Selling Products
    const topProductsQuery = `
      SELECT 
        p.name,
        p.id,
        SUM(si.qty) as total_qty,
        SUM(si.qty * si.unit_price_cents) as total_revenue
      FROM sale_items si
      JOIN product_variants pv ON si.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= $1 AND s.created_at <= $2 
      AND s.status = 'sale'
      GROUP BY p.id, p.name
      ORDER BY total_qty DESC
      LIMIT 10
    `;

    const topProductsResult = window.ezsite.db.query(topProductsQuery, [start.toISOString(), end.toISOString()]);
    analytics.kpis.topProducts = topProductsResult.rows;

    // Top Categories
    const topCategoriesQuery = `
      SELECT 
        c.name,
        c.id,
        SUM(si.qty) as total_qty,
        SUM(si.qty * si.unit_price_cents) as total_revenue
      FROM sale_items si
      JOIN product_variants pv ON si.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= $1 AND s.created_at <= $2 
      AND s.status = 'sale'
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const topCategoriesResult = window.ezsite.db.query(topCategoriesQuery, [start.toISOString(), end.toISOString()]);
    analytics.kpis.topCategories = topCategoriesResult.rows;

    // Payment Method Distribution
    const paymentQuery = `
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(total_cents) as total_amount
      FROM sales
      WHERE created_at >= $1 AND created_at <= $2 
      AND status = 'sale'
      GROUP BY payment_method
    `;

    const paymentResult = window.ezsite.db.query(paymentQuery, [start.toISOString(), end.toISOString()]);
    analytics.charts.paymentMethods = paymentResult.rows;

    // Returns Rate
    const returnsQuery = `
      SELECT 
        COUNT(DISTINCT r.id) as return_count,
        COUNT(DISTINCT s.id) as total_sales,
        r.reason,
        COUNT(r.id) as reason_count
      FROM returns r
      JOIN sales s ON r.sale_id = s.id
      WHERE s.created_at >= $1 AND s.created_at <= $2
      GROUP BY r.reason
    `;

    const returnsResult = window.ezsite.db.query(returnsQuery, [start.toISOString(), end.toISOString()]);
    analytics.kpis.returns = returnsResult.rows;

    // Employee Sales Leaderboard
    const employeeQuery = `
      SELECT 
        e.name as employee_name,
        e.id as employee_id,
        COUNT(s.id) as transaction_count,
        SUM(s.total_cents) as total_sales,
        AVG(s.total_cents) as avg_sale_value
      FROM sales s
      JOIN employees e ON s.created_by = e.user_id
      WHERE s.created_at >= $1 AND s.created_at <= $2 
      AND s.status = 'sale'
      GROUP BY e.id, e.name
      ORDER BY total_sales DESC
      LIMIT 10
    `;

    const employeeResult = window.ezsite.db.query(employeeQuery, [start.toISOString(), end.toISOString()]);
    analytics.kpis.employeeLeaderboard = employeeResult.rows;

    // Low Stock Alerts
    const lowStockQuery = `
      SELECT 
        p.name as product_name,
        p.id as product_id,
        pv.size,
        pv.color,
        il.qty_on_hand,
        p.min_stock_level
      FROM inventory_lots il
      JOIN product_variants pv ON il.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE il.qty_on_hand <= COALESCE(p.min_stock_level, 10)
      ORDER BY il.qty_on_hand ASC
      LIMIT 20
    `;

    const lowStockResult = window.ezsite.db.query(lowStockQuery);
    analytics.kpis.lowStockAlerts = lowStockResult.rows;

    // Sales Trend Data (Daily for the period)
    const trendQuery = `
      SELECT 
        DATE(created_at) as sale_date,
        COUNT(*) as transaction_count,
        SUM(total_cents) as daily_revenue,
        AVG(total_cents) as avg_basket
      FROM sales
      WHERE created_at >= $1 AND created_at <= $2 
      AND status = 'sale'
      GROUP BY DATE(created_at)
      ORDER BY sale_date ASC
    `;

    const trendResult = window.ezsite.db.query(trendQuery, [start.toISOString(), end.toISOString()]);
    analytics.charts.salesTrend = trendResult.rows;

    // Category Revenue Breakdown for Pie Chart
    const categoryBreakdownQuery = `
      SELECT 
        c.name as category_name,
        SUM(si.qty * si.unit_price_cents) as category_revenue,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sale_items si
      JOIN product_variants pv ON si.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= $1 AND s.created_at <= $2 
      AND s.status = 'sale'
      GROUP BY c.id, c.name
      ORDER BY category_revenue DESC
    `;

    const categoryBreakdownResult = window.ezsite.db.query(categoryBreakdownQuery, [start.toISOString(), end.toISOString()]);
    analytics.charts.categoryBreakdown = categoryBreakdownResult.rows;

    // Inventory Levels by Category
    const inventoryQuery = `
      SELECT 
        c.name as category_name,
        SUM(il.qty_on_hand) as total_stock,
        COUNT(DISTINCT p.id) as product_count
      FROM inventory_lots il
      JOIN product_variants pv ON il.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY total_stock DESC
    `;

    const inventoryResult = window.ezsite.db.query(inventoryQuery);
    analytics.charts.inventoryLevels = inventoryResult.rows;

    return analytics;

  } catch (error) {
    throw new Error(`Failed to fetch dashboard analytics: ${error.message}`);
  }
}