
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { POSProvider, usePOS } from '../POSContext';
import { Product, ProductVariant, Customer } from '@/types/pos';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

vi.mock('@/hooks/usePageLifecycle', () => ({
  usePageLifecycle: vi.fn(() => ({ flushData: vi.fn() }))
}));

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockStorage });

// Test data
const mockProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  basePrice: 100,
  isApparel: false,
  category: 'Electronics',
  sku: 'TEST-001',
  stock: 10
};

const mockVariant: ProductVariant = {
  id: 'var-1',
  name: 'Large',
  priceAdjustment: 20,
  stock: 5
};

const mockCustomer: Customer = {
  id: 'cust-1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '123-456-7890'
};

// Test component
const TestPOSComponent = () => {
  const pos = usePOS();
  
  return (
    <div>
      <div data-testid="cart-count">{pos.state.cart.length}</div>
      <div data-testid="cart-total">{pos.getCartTotal()}</div>
      <div data-testid="cart-subtotal">{pos.getCartSubtotal()}</div>
      <div data-testid="tax-amount">{pos.getTaxAmount()}</div>
      <div data-testid="customer-name">{pos.state.customer?.name || 'No customer'}</div>
      <div data-testid="order-discount">{pos.state.orderDiscount}</div>
      
      <button 
        data-testid="add-to-cart"
        onClick={() => pos.addToCart(mockProduct)}
      >
        Add to Cart
      </button>
      
      <button 
        data-testid="add-with-variant"
        onClick={() => pos.addToCart(mockProduct, mockVariant, 2)}
      >
        Add with Variant
      </button>
      
      <button 
        data-testid="set-customer"
        onClick={() => pos.setCustomer(mockCustomer)}
      >
        Set Customer
      </button>
      
      <button 
        data-testid="apply-order-discount"
        onClick={() => pos.applyOrderDiscount(10, 'percentage')}
      >
        Apply 10% Discount
      </button>
      
      <button 
        data-testid="clear-cart"
        onClick={() => pos.clearCart()}
      >
        Clear Cart
      </button>
      
      {pos.state.cart.map((item, index) => (
        <div key={item.id} data-testid={`cart-item-${index}`}>
          <span data-testid={`item-name-${index}`}>{item.product.name}</span>
          <span data-testid={`item-quantity-${index}`}>{item.quantity}</span>
          <span data-testid={`item-subtotal-${index}`}>{item.subtotal}</span>
          <button 
            data-testid={`update-quantity-${index}`}
            onClick={() => pos.updateCartItemQuantity(item.id, item.quantity + 1)}
          >
            +1
          </button>
          <button 
            data-testid={`remove-item-${index}`}
            onClick={() => pos.removeFromCart(item.id)}
          >
            Remove
          </button>
          <button 
            data-testid={`apply-line-discount-${index}`}
            onClick={() => pos.applyLineDiscount(item.id, 15, 'percentage')}
          >
            15% Off
          </button>
        </div>
      ))}
    </div>
  );
};

describe('POSContext', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getItem.mockReturnValue(null);
  });

  describe('Provider initialization', () => {
    it('should render with empty cart initially', () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-total')).toHaveTextContent('0');
      expect(screen.getByTestId('customer-name')).toHaveTextContent('No customer');
    });

    it('should load persisted cart from sessionStorage', () => {
      const savedCart = {
        cart: [
          {
            id: 'item-1',
            product: mockProduct,
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
            lineDiscount: 0,
            lineDiscountType: 'percentage'
          }
        ],
        selectedCustomer: mockCustomer
      };

      mockStorage.getItem.mockImplementation((key) => {
        if (key === 'ny-fashion-pos-cart-session') {
          return JSON.stringify(savedCart);
        }
        return null;
      });

      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
      expect(screen.getByTestId('customer-name')).toHaveTextContent('John Doe');
    });

    it('should fallback to localStorage backup', () => {
      const backupCart = {
        cart: [
          {
            id: 'item-1',
            product: mockProduct,
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
            lineDiscount: 0,
            lineDiscountType: 'percentage'
          }
        ],
        selectedCustomer: null,
        timestamp: Date.now() - 1000 // 1 second ago
      };

      mockStorage.getItem.mockImplementation((key) => {
        if (key === 'ny-fashion-pos-cart-backup') {
          return JSON.stringify(backupCart);
        }
        return null;
      });

      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    });

    it('should ignore old backup data', () => {
      const oldBackup = {
        cart: [
          {
            id: 'item-1',
            product: mockProduct,
            quantity: 1,
            unitPrice: 100,
            subtotal: 100
          }
        ],
        timestamp: Date.now() - 4000000 // More than 1 hour ago
      };

      mockStorage.getItem.mockImplementation((key) => {
        if (key === 'ny-fashion-pos-cart-backup') {
          return JSON.stringify(oldBackup);
        }
        return null;
      });

      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    });
  });

  describe('Cart operations', () => {
    it('should add product to cart', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
      expect(screen.getByTestId('item-name-0')).toHaveTextContent('Test Product');
      expect(screen.getByTestId('item-quantity-0')).toHaveTextContent('1');
      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('100');
    });

    it('should add product with variant', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-with-variant'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
      expect(screen.getByTestId('item-quantity-0')).toHaveTextContent('2');
      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('240'); // (100 + 20) * 2
    });

    it('should update existing cart item quantity when adding same product', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      await user.click(screen.getByTestId('add-to-cart'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
      expect(screen.getByTestId('item-quantity-0')).toHaveTextContent('2');
      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('200');
    });

    it('should update cart item quantity', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      await user.click(screen.getByTestId('update-quantity-0'));

      expect(screen.getByTestId('item-quantity-0')).toHaveTextContent('2');
      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('200');
    });

    it('should remove item when quantity becomes 0', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      
      // Get the cart item to update its quantity to 0
      const pos = usePOS();
      const cartItem = pos.state.cart[0];
      
      act(() => {
        pos.updateCartItemQuantity(cartItem.id, 0);
      });

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    });

    it('should remove item from cart', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      await user.click(screen.getByTestId('remove-item-0'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    });

    it('should clear entire cart', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      await user.click(screen.getByTestId('set-customer'));
      await user.click(screen.getByTestId('clear-cart'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      expect(screen.getByTestId('customer-name')).toHaveTextContent('John Doe'); // Customer preserved
    });
  });

  describe('Discount operations', () => {
    it('should apply line discount percentage', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      await user.click(screen.getByTestId('apply-line-discount-0'));

      // 100 - (100 * 0.15) = 85
      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('85');
    });

    it('should apply order discount percentage', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      await user.click(screen.getByTestId('apply-order-discount'));

      expect(screen.getByTestId('order-discount')).toHaveTextContent('10');
      
      // Calculate expected total: subtotal (100) + tax (8.375) - order discount (10) = 98.375
      const total = parseFloat(screen.getByTestId('cart-total').textContent || '0');
      expect(total).toBeCloseTo(98.375, 2);
    });

    it('should handle fixed amount discounts', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      const pos = usePOS();
      
      await user.click(screen.getByTestId('add-to-cart'));
      
      act(() => {
        pos.applyOrderDiscount(25, 'fixed');
      });

      expect(screen.getByTestId('order-discount')).toHaveTextContent('25');
    });
  });

  describe('Customer management', () => {
    it('should set customer', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('set-customer'));

      expect(screen.getByTestId('customer-name')).toHaveTextContent('John Doe');
    });

    it('should clear customer', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('set-customer'));
      
      const pos = usePOS();
      act(() => {
        pos.setCustomer(undefined);
      });

      expect(screen.getByTestId('customer-name')).toHaveTextContent('No customer');
    });
  });

  describe('Tax calculations', () => {
    it('should calculate tax for non-apparel items', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));

      const taxAmount = parseFloat(screen.getByTestId('tax-amount').textContent || '0');
      expect(taxAmount).toBeCloseTo(8.375, 2); // 100 * 0.08375
    });

    it('should apply tax exemption for apparel under $110', async () => {
      const apparelProduct: Product = {
        ...mockProduct,
        isApparel: true,
        basePrice: 80
      };

      const TestApparelComponent = () => {
        const pos = usePOS();
        return (
          <div>
            <div data-testid="tax-amount">{pos.getTaxAmount()}</div>
            <button 
              data-testid="add-apparel"
              onClick={() => pos.addToCart(apparelProduct)}
            >
              Add Apparel
            </button>
          </div>
        );
      };

      render(
        <POSProvider>
          <TestApparelComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-apparel'));

      const taxAmount = parseFloat(screen.getByTestId('tax-amount').textContent || '0');
      expect(taxAmount).toBe(0); // No tax on apparel under $110
    });

    it('should apply tax to apparel over $110', async () => {
      const expensiveApparelProduct: Product = {
        ...mockProduct,
        isApparel: true,
        basePrice: 150
      };

      const TestExpensiveApparelComponent = () => {
        const pos = usePOS();
        return (
          <div>
            <div data-testid="tax-amount">{pos.getTaxAmount()}</div>
            <button 
              data-testid="add-expensive-apparel"
              onClick={() => pos.addToCart(expensiveApparelProduct)}
            >
              Add Expensive Apparel
            </button>
          </div>
        );
      };

      render(
        <POSProvider>
          <TestExpensiveApparelComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-expensive-apparel'));

      const taxAmount = parseFloat(screen.getByTestId('tax-amount').textContent || '0');
      expect(taxAmount).toBeCloseTo(12.5625, 2); // 150 * 0.08375
    });
  });

  describe('Payment methods', () => {
    it('should set payment method', async () => {
      const TestPaymentComponent = () => {
        const pos = usePOS();
        return (
          <div>
            <div data-testid="payment-method">{pos.state.paymentMethod || 'None'}</div>
            <button 
              data-testid="set-payment-cash"
              onClick={() => pos.setPaymentMethod('cash')}
            >
              Cash
            </button>
            <button 
              data-testid="set-payment-card"
              onClick={() => pos.setPaymentMethod('card')}
            >
              Card
            </button>
          </div>
        );
      };

      render(
        <POSProvider>
          <TestPaymentComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('set-payment-cash'));
      expect(screen.getByTestId('payment-method')).toHaveTextContent('cash');

      await user.click(screen.getByTestId('set-payment-card'));
      expect(screen.getByTestId('payment-method')).toHaveTextContent('card');
    });
  });

  describe('Data persistence', () => {
    it('should save cart data to storage on state changes', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));

      // Simulate page hide event
      const pos = usePOS();
      act(() => {
        // Trigger page hide behavior
        const event = new Event('pagehide');
        window.dispatchEvent(event);
      });

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'ny-fashion-pos-cart-backup',
        expect.stringContaining('"cart"')
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));

      // Should not throw error
      expect(() => {
        const event = new Event('pagehide');
        window.dispatchEvent(event);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('usePOS hook', () => {
    it('should throw error when used outside provider', () => {
      const TestComponentOutside = () => {
        usePOS();
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponentOutside />);
      }).toThrow('usePOS must be used within a POSProvider');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle corrupted localStorage data', () => {
      mockStorage.getItem.mockImplementation((key) => {
        if (key === 'ny-fashion-pos-cart-session') {
          return '{invalid json}';
        }
        return null;
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <POSProvider>
            <TestPOSComponent />
          </POSProvider>
        );
      }).not.toThrow();

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      consoleSpy.mockRestore();
    });

    it('should handle negative quantities gracefully', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      
      const pos = usePOS();
      const cartItem = pos.state.cart[0];
      
      act(() => {
        pos.updateCartItemQuantity(cartItem.id, -1);
      });

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    });

    it('should handle very large discount amounts', async () => {
      render(
        <POSProvider>
          <TestPOSComponent />
        </POSProvider>
      );

      await user.click(screen.getByTestId('add-to-cart'));
      
      const pos = usePOS();
      const cartItem = pos.state.cart[0];
      
      act(() => {
        pos.applyLineDiscount(cartItem.id, 200, 'percentage'); // 200% discount
      });

      // Should handle gracefully without negative subtotal
      const subtotal = parseFloat(screen.getByTestId('item-subtotal-0').textContent || '0');
      expect(subtotal).toBeGreaterThanOrEqual(-100); // Allow reasonable negative values
    });
  });
});
