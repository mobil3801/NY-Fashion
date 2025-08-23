
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestResultAggregator } from './api-test-utils';

// Mock components for integration testing
const MockInventoryPage = () => {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [{}]
      });
      if (error) throw new Error(error);
      setProducts(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div>
      <h1>Inventory Management</h1>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      <div data-testid="product-count">{products.length} products</div>
      <button onClick={fetchProducts} data-testid="refresh-btn">
        Refresh
      </button>
    </div>);

};

// Mock window.ezsite.apis
const mockApis = {
  run: vi.fn(),
  tablePage: vi.fn()
};

// @ts-ignore
global.window = {
  ezsite: {
    apis: mockApis
  }
};

// @ts-ignore
global.React = require('react');

describe('Inventory Integration Tests', () => {
  let queryClient: QueryClient;
  let testResults: TestResultAggregator;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    testResults = new TestResultAggregator();
    vi.clearAllMocks();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Product Management Integration', () => {
    it('should load and display products correctly', async () => {
      const mockProducts = [
      { id: 1, name: 'Test Product 1', selling_price: 99.99 },
      { id: 2, name: 'Test Product 2', selling_price: 149.99 }];


      mockApis.run.mockResolvedValue({ data: mockProducts, error: null });

      renderWithQuery(<MockInventoryPage />);

      // Check loading state
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('product-count')).toHaveTextContent('2 products');
      });

      // Verify loading state is gone
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();

      testResults.addResult('product_loading_integration', {
        success: true,
        productsLoaded: mockProducts.length,
        integrationTest: true
      });
    });

    it('should handle API errors gracefully in UI', async () => {
      mockApis.run.mockResolvedValue({
        data: null,
        error: 'Failed to fetch products'
      });

      renderWithQuery(<MockInventoryPage />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch products');
      });

      // Verify product count shows 0
      expect(screen.getByTestId('product-count')).toHaveTextContent('0 products');

      testResults.addResult('error_handling_integration', {
        success: true,
        errorDisplayed: true,
        integrationTest: true
      });
    });

    it('should allow refresh functionality', async () => {
      // Initial load returns empty
      mockApis.run.mockResolvedValueOnce({ data: [], error: null });

      renderWithQuery(<MockInventoryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('product-count')).toHaveTextContent('0 products');
      });

      // Setup new data for refresh
      const refreshedProducts = [
      { id: 3, name: 'Refreshed Product', selling_price: 79.99 }];

      mockApis.run.mockResolvedValueOnce({ data: refreshedProducts, error: null });

      // Click refresh
      fireEvent.click(screen.getByTestId('refresh-btn'));

      // Wait for refresh to complete
      await waitFor(() => {
        expect(screen.getByTestId('product-count')).toHaveTextContent('1 products');
      });

      testResults.addResult('refresh_functionality_integration', {
        success: true,
        refreshWorked: true,
        integrationTest: true
      });
    });
  });

  describe('Stock Movement Integration', () => {
    it('should handle stock movement creation flow', async () => {
      const MockStockMovementForm = () => {
        const [result, setResult] = React.useState(null);
        const [loading, setLoading] = React.useState(false);

        const handleSubmit = async () => {
          setLoading(true);
          try {
            const { data, error } = await window.ezsite.apis.run({
              path: "addStockMovement",
              param: [{
                variant_id: 1,
                delta: 50,
                type: 'receipt',
                reason: 'New stock receipt'
              }]
            });
            if (error) throw new Error(error);
            setResult(data);
          } catch (err) {
            setResult({ error: err.message });
          } finally {
            setLoading(false);
          }
        };

        return (
          <div>
            <button onClick={handleSubmit} data-testid="add-stock-btn">
              Add Stock
            </button>
            {loading && <div data-testid="loading">Processing...</div>}
            {result &&
            <div data-testid="result">
                {result.error ? result.error : `Movement ID: ${result.id}`}
              </div>
            }
          </div>);

      };

      mockApis.run.mockResolvedValue({
        data: { id: 123, message: 'Stock movement recorded successfully' },
        error: null
      });

      renderWithQuery(<MockStockMovementForm />);

      // Click add stock button
      fireEvent.click(screen.getByTestId('add-stock-btn'));

      // Check loading state
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('result')).toHaveTextContent('Movement ID: 123');
      });

      testResults.addResult('stock_movement_creation_integration', {
        success: true,
        movementCreated: true,
        movementId: 123,
        integrationTest: true
      });
    });
  });

  describe('Error Boundary Integration', () => {
    it('should handle component crashes gracefully', async () => {
      const ErrorBoundary = class extends React.Component {
        constructor(props: any) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError() {
          return { hasError: true };
        }

        render() {
          if ((this.state as any).hasError) {
            return <div data-testid="error-boundary">Something went wrong!</div>;
          }
          return this.props.children;
        }
      };

      const CrashingComponent = () => {
        React.useEffect(() => {
          throw new Error('Intentional crash for testing');
        }, []);

        return <div>This should crash</div>;
      };

      renderWithQuery(
        <ErrorBoundary>
          <CrashingComponent />
        </ErrorBoundary>
      );

      // Wait for error boundary to catch the error
      await waitFor(() => {
        expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      });

      testResults.addResult('error_boundary_integration', {
        success: true,
        errorBoundaryCaught: true,
        integrationTest: true
      });
    });
  });

  describe('Performance Integration', () => {
    it('should handle large dataset rendering efficiently', async () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        selling_price: (i + 1) * 10
      }));

      mockApis.run.mockResolvedValue({ data: largeDataset, error: null });

      const startTime = performance.now();
      renderWithQuery(<MockInventoryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('product-count')).toHaveTextContent('1000 products');
      });

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (5 seconds)
      expect(renderTime).toBeLessThan(5000);

      testResults.addResult('large_dataset_performance_integration', {
        success: renderTime < 5000,
        datasetSize: largeDataset.length,
        renderTime,
        performanceThreshold: 5000,
        integrationTest: true,
        performanceTest: true
      });
    });
  });

  describe('User Interaction Flows', () => {
    it('should handle complete product creation flow', async () => {
      const MockProductForm = () => {
        const [formData, setFormData] = React.useState({
          name: '',
          category_id: 1,
          cost_cents: 0,
          price_cents: 0
        });
        const [result, setResult] = React.useState(null);

        const handleSubmit = async () => {
          try {
            const { data, error } = await window.ezsite.apis.run({
              path: "saveProduct",
              param: [formData]
            });
            if (error) throw new Error(error);
            setResult(data);
          } catch (err) {
            setResult({ error: err.message });
          }
        };

        return (
          <div>
            <input
              data-testid="product-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Product Name" />

            <input
              data-testid="product-price"
              type="number"
              value={formData.price_cents}
              onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
              placeholder="Price (cents)" />

            <button onClick={handleSubmit} data-testid="save-btn">
              Save Product
            </button>
            {result &&
            <div data-testid="save-result">
                {result.error ? result.error : `Product saved with ID: ${result.id}`}
              </div>
            }
          </div>);

      };

      mockApis.run.mockResolvedValue({
        data: { id: 456, message: 'Product created successfully' },
        error: null
      });

      renderWithQuery(<MockProductForm />);

      // Fill form
      fireEvent.change(screen.getByTestId('product-name'), {
        target: { value: 'Integration Test Product' }
      });
      fireEvent.change(screen.getByTestId('product-price'), {
        target: { value: '9999' }
      });

      // Submit form
      fireEvent.click(screen.getByTestId('save-btn'));

      // Wait for result
      await waitFor(() => {
        expect(screen.getByTestId('save-result')).toHaveTextContent('Product saved with ID: 456');
      });

      testResults.addResult('product_creation_flow_integration', {
        success: true,
        productCreated: true,
        productId: 456,
        userInteractionFlow: true,
        integrationTest: true
      });
    });
  });

  describe('Integration Test Summary', () => {
    it('should provide comprehensive integration test summary', () => {
      const summary = testResults.getSummary();

      console.log('\n=== INTEGRATION TEST SUMMARY ===');
      console.log(`Total Tests: ${summary.total}`);
      console.log(`Passed: ${summary.passed}`);
      console.log(`Failed: ${summary.failed}`);
      console.log(`Pass Rate: ${summary.passRate.toFixed(2)}%`);

      const integrationTests = summary.results.filter((r) => r.result.integrationTest);
      const performanceTests = integrationTests.filter((r) => r.result.performanceTest);
      const userFlowTests = integrationTests.filter((r) => r.result.userInteractionFlow);

      console.log('\n=== TEST CATEGORIES ===');
      console.log(`Integration Tests: ${integrationTests.length}`);
      console.log(`Performance Tests: ${performanceTests.length}`);
      console.log(`User Flow Tests: ${userFlowTests.length}`);

      testResults.addResult('integration_test_summary', {
        success: true,
        summary,
        testCategories: {
          integration: integrationTests.length,
          performance: performanceTests.length,
          userFlow: userFlowTests.length
        },
        summaryReport: true
      });

      expect(summary.total).toBeGreaterThan(0);
    });
  });
});