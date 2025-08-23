
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { POSState, CartItem, Customer, PaymentMethod, Product, ProductVariant } from '@/types/pos';

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
{type: 'CLEAR_CART';};

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

    default:
      return state;
  }
};

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{children: ReactNode;}> = ({ children }) => {
  const [state, dispatch] = useReducer(posReducer, initialState);

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