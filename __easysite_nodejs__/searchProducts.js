
function searchProducts(query, searchType = 'name') {
  // Mock data for demonstration - replace with actual database queries
  const mockProducts = [
  {
    id: 'prod-1',
    sku: 'TSHIRT-001',
    barcode: '1234567890123',
    name: 'Basic Cotton T-Shirt',
    description: 'Comfortable cotton t-shirt',
    category: 'Apparel',
    basePrice: 25.99,
    isApparel: true,
    isActive: true,
    currentStock: 50,
    minStockLevel: 10,
    variants: [
    {
      id: 'var-1',
      productId: 'prod-1',
      size: 'M',
      color: 'Blue',
      sku: 'TSHIRT-001-M-BLU',
      barcode: '1234567890124',
      priceAdjustment: 0,
      stockQuantity: 20
    },
    {
      id: 'var-2',
      productId: 'prod-1',
      size: 'L',
      color: 'Blue',
      sku: 'TSHIRT-001-L-BLU',
      barcode: '1234567890125',
      priceAdjustment: 2,
      stockQuantity: 15
    }]

  },
  {
    id: 'prod-2',
    sku: 'JEANS-001',
    barcode: '2234567890123',
    name: 'Premium Denim Jeans',
    description: 'High-quality denim jeans',
    category: 'Apparel',
    basePrice: 89.99,
    isApparel: true,
    isActive: true,
    currentStock: 30,
    minStockLevel: 5,
    variants: [
    {
      id: 'var-3',
      productId: 'prod-2',
      size: '32',
      color: 'Dark Blue',
      sku: 'JEANS-001-32-DB',
      barcode: '2234567890124',
      priceAdjustment: 0,
      stockQuantity: 12
    }]

  },
  {
    id: 'prod-3',
    sku: 'ACCESSORY-001',
    barcode: '3234567890123',
    name: 'Leather Wallet',
    description: 'Premium leather wallet',
    category: 'Accessories',
    basePrice: 45.99,
    isApparel: false,
    isActive: true,
    currentStock: 25,
    minStockLevel: 5,
    variants: []
  }];


  let results = [];

  switch (searchType) {
    case 'barcode':
      results = mockProducts.filter((product) =>
      product.barcode === query ||
      product.variants.some((variant) => variant.barcode === query)
      );
      break;
    case 'sku':
      results = mockProducts.filter((product) =>
      product.sku.toLowerCase().includes(query.toLowerCase()) ||
      product.variants.some((variant) =>
      variant.sku.toLowerCase().includes(query.toLowerCase())
      )
      );
      break;
    default: // name search
      results = mockProducts.filter((product) =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.description?.toLowerCase().includes(query.toLowerCase())
      );
      break;
  }

  return results.filter((product) => product.isActive);
}