
import React from 'react';
import EnhancedStockMovement from './EnhancedStockMovement';
import InventoryErrorBoundary from './ErrorBoundary';

const StockMovement = () => {
  return (
    <InventoryErrorBoundary>
      <EnhancedStockMovement />
    </InventoryErrorBoundary>);

};

export default StockMovement;