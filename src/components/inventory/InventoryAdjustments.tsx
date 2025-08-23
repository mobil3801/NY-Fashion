
import React from 'react';
import EnhancedInventoryAdjustments from './EnhancedInventoryAdjustments';
import InventoryErrorBoundary from './ErrorBoundary';

const InventoryAdjustments = () => {
  return (
    <InventoryErrorBoundary>
      <EnhancedInventoryAdjustments />
    </InventoryErrorBoundary>);

};

export default InventoryAdjustments;