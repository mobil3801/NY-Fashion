
import React from 'react';
import EnhancedProductManagement from './EnhancedProductManagement';
import InventoryErrorBoundary from './ErrorBoundary';

const ProductManagement = () => {
  return (
    <InventoryErrorBoundary>
      <EnhancedProductManagement />
    </InventoryErrorBoundary>
  );
};

export default ProductManagement;
