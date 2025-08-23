
async function initInventory() {
  try {
    // Create inventory tables
    const { data: tablesResult, error: tablesError } = await window.ezsite.apis.run({
      path: 'createInventoryTables',
      param: []
    });

    if (tablesError) {
      throw new Error(tablesError.message);
    }

    return {
      success: true,
      message: 'Inventory system initialized successfully',
      details: tablesResult
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to initialize inventory system',
      error: error.message
    };
  }
}