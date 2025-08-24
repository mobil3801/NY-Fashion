
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { POSState, CartItem, Customer, PaymentMethod, Product, ProductVariant } from '@/types/pos';
import { toast } from '@/hooks/use-toast';
import { usePageLifecycle } from '@/hooks/usePageLifecycle';

interface POSContextType {
  state: POSState;
  addToCart: (product: Product, variant?: ProductVariant, quantity?: number) => void;
  updateCartItemQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  applyLineDiscount: (itemId: string, discount: number, type: 'percentage' | 'fixed') => void;
  applyOrderDiscount: (discount: number, type: 'percentage' | 'fixed') => void;
  setCustomer: (customer: Customer | undefined) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartSubtotal: () => number;
  getTaxAmount: () => number;
}

type POSAction =
{type: 'ADD_TO_CART';payload: {product: Product;variant?: ProductVariant;quantity: number;};} |
{type: 'UPDATE_QUANTITY';payload: {itemId: string;quantity: number;};} |
{type: 'REMOVE_FROM_CART';payload: {itemId: string;};} |
{type: 'APPLY_LINE_DISCOUNT';payload: {itemId: string;discount: number;type: 'percentage' | 'fixed';};} |
{type: 'APPLY_ORDER_DISCOUNT';payload: {discount: number;type: 'percentage' | 'fixed';};} |
{type: 'SET_CUSTOMER';payload: {customer: Customer | undefined;};} |
{type: 'SET_PAYMENT_METHOD';payload: {method: PaymentMethod;};} |
{type: 'CLEAR_CART';} |
{type: 'RESTORE_CART';payload: {cart: CartItem[];customer?: Customer | undefined;};};

const initialState: POSState = {
  cart: [],
  orderDiscount: 0,
  orderDiscountType: 'percentage'
};

// NYC Tax calculation - apparel under $110 is exempt
const calculateTax = (items: CartItem[]): {taxableAmount: number;taxAmount: number;exemptAmount: number;} => {
  let taxableAmount = 0;
  let exemptAmount = 0;
  const NYCTaxRate = 0.08375; // NYC sales tax rate

  items.forEach((item) => {
    const itemTotal = item.subtotal;
    if (item.product.isApparel && itemTotal < 110) {
      exemptAmount += itemTotal;
    } else {
      taxableAmount += itemTotal;
    }
  });

  const taxAmount = taxableAmount * NYCTaxRate;
  return { taxableAmount, taxAmount, exemptAmount };
};

const posReducer = (state: POSState, action: POSAction): POSState => {
  switch (action.type) {
    case 'ADD_TO_CART':{
        const { product, variant, quantity } = action.payload;
        const existingItemIndex = state.cart.findIndex(
          (item) => item.product.id === product.id &&
          item.variant?.id === variant?.id
        );

        if (existingItemIndex >= 0) {
          const updatedCart = [...state.cart];
          updatedCart[existingItemIndex].quantity += quantity;
          updatedCart[existingItemIndex].subtotal =
          updatedCart[existingItemIndex].quantity * updatedCart[existingItemIndex].unitPrice;
          return { ...state, cart: updatedCart };
        }

        const unitPrice = product.basePrice + (variant?.priceAdjustment || 0);
        const newItem: CartItem = {
          id: `${product.id}-${variant?.id || 'default'}-${Date.now()}`,
          product,
          variant,
          quantity,
          unitPrice,
          lineDiscount: 0,
          lineDiscountType: 'percentage',
          subtotal: unitPrice * quantity
        };

        return { ...state, cart: [...state.cart, newItem] };
      }

    case 'UPDATE_QUANTITY':{
        const { itemId, quantity } = action.payload;
        if (quantity <= 0) {
          return { ...state, cart: state.cart.filter((item) => item.id !== itemId) };
        }

        const updatedCart = state.cart.map((item) => {
          if (item.id === itemId) {
            const baseSubtotal = item.unitPrice * quantity;
            const discountAmount = item.lineDiscountType === 'percentage' ?
            baseSubtotal * (item.lineDiscount / 100) :
            item.lineDiscount;
            return {
              ...item,
              quantity,
              subtotal: baseSubtotal - discountAmount
            };
          }
          return item;
        });

        return { ...state, cart: updatedCart };
      }

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter((item) => item.id !== action.payload.itemId)
      };

    case 'APPLY_LINE_DISCOUNT':{
        const { itemId, discount, type } = action.payload;
        const updatedCart = state.cart.map((item) => {
          if (item.id === itemId) {
            const baseSubtotal = item.unitPrice * item.quantity;
            const discountAmount = type === 'percentage' ?
            baseSubtotal * (discount / 100) :
            discount;
            return {
              ...item,
              lineDiscount: discount,
              lineDiscountType: type,
              subtotal: baseSubtotal - discountAmount
            };
          }
          return item;
        });

        return { ...state, cart: updatedCart };
      }

    case 'APPLY_ORDER_DISCOUNT':
      return {
        ...state,
        orderDiscount: action.payload.discount,
        orderDiscountType: action.payload.type
      };

    case 'SET_CUSTOMER':
      return { ...state, customer: action.payload.customer };

    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload.method };

    case 'CLEAR_CART':
      return {
        ...initialState,
        customer: state.customer // Keep customer for next transaction
      };

    case 'RESTORE_CART':
      return {
        ...state,
        cart: action.payload.cart || [],
        customer: action.payload.customer
      };

    default:
      return state;
  }
};

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{children: ReactNode;}> = ({ children }) => {
  const [state, dispatch] = useReducer(posReducer, initialState);

  // Use modern lifecycle management for cart persistence
  const { flushData } = usePageLifecycle({
    persistenceKey: 'ny-fashion-pos-cart',
    autoFlushData: {
      url: '/api/pos/persist-cart',
      getData: () => ({
        cart: state.cart,
        selectedCustomer: state.customer,
        timestamp: Date.now()
      })
    },
    onPageHide: () => {
      // Save cart state when page is hidden/unloaded
      if (state.cart.length > 0) {
        const cartData = {
          cart: state.cart,
          selectedCustomer: state.customer,
          timestamp: Date.now()
        };
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('ny-fashion-pos-cart-backup', JSON.stringify(cartData));
          } catch (error) {
            console.warn('Failed to save cart to localStorage:', error);
          }
        }
        // Also save to sessionStorage for more immediate access
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem('ny-fashion-pos-cart-session', JSON.stringify(cartData));
          } catch (error) {
            console.warn('Failed to save cart to sessionStorage:', error);
          }
        }
      }
    },
    onVisibilityChange: (isVisible) => {
      if (!isVisible && state.cart.length > 0) {
        // Auto-save when page becomes hidden
        const cartData = {
          cart: state.cart,
          selectedCustomer: state.customer,
          timestamp: Date.now()
        };
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('ny-fashion-pos-cart-backup', JSON.stringify(cartData));
          } catch (error) {
            console.warn('Failed to save cart to localStorage:', error);
          }
        }
        // sessionStorage is cleared when the session ends (tab close)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem('ny-fashion-pos-cart-session', JSON.stringify(cartData));
          } catch (error) {
            console.warn('Failed to save cart to sessionStorage:', error);
          }
        }
      }
    }
  });

  // Load cart from storage on mount (with SSR safety)
  useEffect(() => {
    // SSR guard - only run on client side
    if (typeof window === 'undefined') return;

    const loadPersistedCart = () => {
      try {
        // Try to load from session storage first (most recent)
        const sessionCart = sessionStorage.getItem('ny-fashion-pos-cart-session');
        if (sessionCart) {
          try {
            const { cart: savedCart, selectedCustomer: savedCustomer } = JSON.parse(sessionCart);
            if (savedCart && Array.isArray(savedCart)) {
              dispatch({ type: 'RESTORE_CART', payload: { cart: savedCart, customer: savedCustomer } });
              return;
            }
          } catch (error) {
            console.warn('Error loading session cart:', error);
          }
        }

        // Then try localStorage backup
        const backupCart = localStorage.getItem('ny-fashion-pos-cart-backup');
        if (backupCart) {
          try {
            const { cart: savedCart, selectedCustomer: savedCustomer, timestamp } = JSON.parse(backupCart);
            // Only restore if backup is less than 1 hour old
            if (Date.now() - timestamp < 3600000) {
              if (savedCart && Array.isArray(savedCart)) {
                dispatch({ type: 'RESTORE_CART', payload: { cart: savedCart, customer: savedCustomer } });
                return;
              }
            }
          } catch (error) {
            console.warn('Error loading backup cart:', error);
          }
        }

        // Fallback to legacy cart storage
        const legacyCart = localStorage.getItem('posCart');
        if (legacyCart) {
          try {
            const parsedCart = JSON.parse(legacyCart);
            // Clean up legacy storage
            localStorage.removeItem('posCart');

            if (parsedCart && Array.isArray(parsedCart)) {
              dispatch({ type: 'RESTORE_CART', payload: { cart: parsedCart, customer: undefined } });

              // Migrate to new format
              const cartData = {
                cart: parsedCart,
                selectedCustomer: null,
                timestamp: Date.now()
              };
              localStorage.setItem('ny-fashion-pos-cart-backup', JSON.stringify(cartData));
            }
          } catch (error) {
            console.error('Error loading legacy cart:', error);
          }
        }
      } catch (storageError) {
        console.warn('Storage access error (possibly SSR or private browsing):', storageError);
      }
    };

    // Use a small delay to ensure DOM is ready
    const timeoutId = setTimeout(loadPersistedCart, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const addToCart = (product: Product, variant?: ProductVariant, quantity: number = 1) => {
    dispatch({ type: 'ADD_TO_CART', payload: { product, variant, quantity } });
  };

  const updateCartItemQuantity = (itemId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { itemId, quantity } });
  };

  const removeFromCart = (itemId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: { itemId } });
  };

  const applyLineDiscount = (itemId: string, discount: number, type: 'percentage' | 'fixed') => {
    dispatch({ type: 'APPLY_LINE_DISCOUNT', payload: { itemId, discount, type } });
  };

  const applyOrderDiscount = (discount: number, type: 'percentage' | 'fixed') => {
    dispatch({ type: 'APPLY_ORDER_DISCOUNT', payload: { discount, type } });
  };

  const setCustomer = (customer: Customer | undefined) => {
    dispatch({ type: 'SET_CUSTOMER', payload: { customer } });
  };

  const setPaymentMethod = (method: PaymentMethod) => {
    dispatch({ type: 'SET_PAYMENT_METHOD', payload: { method } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getCartSubtotal = () => {
    return state.cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getTaxAmount = () => {
    const { taxAmount } = calculateTax(state.cart);
    return taxAmount;
  };

  const getCartTotal = () => {
    const subtotal = getCartSubtotal();
    const tax = getTaxAmount();
    const orderDiscountAmount = state.orderDiscountType === 'percentage' ?
    subtotal * (state.orderDiscount / 100) :
    state.orderDiscount;
    return subtotal + tax - orderDiscountAmount;
  };

  return (
    <POSContext.Provider value={{
      state,
      addToCart,
      updateCartItemQuantity,
      removeFromCart,
      applyLineDiscount,
      applyOrderDiscount,
      setCustomer,
      setPaymentMethod,
      clearCart,
      getCartTotal,
      getCartSubtotal,
      getTaxAmount
    }}>
      {children}
    </POSContext.Provider>);

};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};