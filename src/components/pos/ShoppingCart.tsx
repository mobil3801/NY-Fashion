
import React, { useState } from 'react';
import { Trash2, Plus, Minus, Percent, DollarSign, ShoppingCart as ShoppingCartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

const ShoppingCart: React.FC = () => {
  const {
    state,
    updateCartItemQuantity,
    removeFromCart,
    applyLineDiscount,
    applyOrderDiscount,
    getCartSubtotal,
    getTaxAmount,
    getCartTotal
  } = usePOS();

  const { user } = useAuth();
  const [lineDiscountDialog, setLineDiscountDialog] = useState<{
    isOpen: boolean;
    itemId: string;
    currentDiscount: number;
    discountType: 'percentage' | 'fixed';
  }>({ isOpen: false, itemId: '', currentDiscount: 0, discountType: 'percentage' });

  const [orderDiscountDialog, setOrderDiscountDialog] = useState<{
    isOpen: boolean;
    discount: number;
    discountType: 'percentage' | 'fixed';
  }>({ isOpen: false, discount: state.orderDiscount, discountType: state.orderDiscountType });

  const canApplyDiscount = hasPermission(user?.role || 'cashier', 'apply_discounts');
  const canApplyLargeDiscount = hasPermission(user?.role || 'cashier', 'apply_large_discounts');

  const subtotal = getCartSubtotal();
  const taxAmount = getTaxAmount();
  const orderDiscountAmount = state.orderDiscountType === 'percentage' ?
  subtotal * (state.orderDiscount / 100) :
  state.orderDiscount;
  const total = getCartTotal();

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = state.cart.find((i) => i.id === itemId);
    if (item) {
      const newQuantity = item.quantity + change;
      if (newQuantity > 0) {
        updateCartItemQuantity(itemId, newQuantity);
      }
    }
  };

  const handleLineDiscount = () => {
    const { itemId, currentDiscount, discountType } = lineDiscountDialog;

    // Check if discount requires approval
    const discountAmount = discountType === 'percentage' ? currentDiscount : currentDiscount;
    const requiresApproval = discountAmount > (discountType === 'percentage' ? 15 : 20);

    if (requiresApproval && !canApplyLargeDiscount) {
      // TODO: Implement manager approval workflow
      alert('This discount requires manager approval');
      return;
    }

    applyLineDiscount(itemId, currentDiscount, discountType);
    setLineDiscountDialog({ isOpen: false, itemId: '', currentDiscount: 0, discountType: 'percentage' });
  };

  const handleOrderDiscount = () => {
    const { discount, discountType } = orderDiscountDialog;

    // Check if discount requires approval
    const requiresApproval = discount > (discountType === 'percentage' ? 10 : 50);

    if (requiresApproval && !canApplyLargeDiscount) {
      // TODO: Implement manager approval workflow
      alert('This discount requires manager approval');
      return;
    }

    applyOrderDiscount(discount, discountType);
    setOrderDiscountDialog({ isOpen: false, discount: 0, discountType: 'percentage' });
  };

  if (state.cart.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ShoppingCartIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Cart is empty</p>
        </CardContent>
      </Card>);

  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{t('pos.cart.title', 'Shopping Cart')}</span>
          <Badge variant="secondary">
            {state.cart.length} {t('pos.cart.items', 'items')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Cart Items */}
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
          {state.cart.map((item) =>
          <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium text-sm">{item.product.name}</h4>
                {item.variant &&
              <p className="text-xs text-gray-500">
                    {item.variant.size && `Size: ${item.variant.size}`}
                    {item.variant.color && ` Color: ${item.variant.color}`}
                  </p>
              }
                <p className="text-xs text-gray-600">
                  ${item.unitPrice.toFixed(2)} each
                </p>
                {item.lineDiscount > 0 &&
              <Badge variant="destructive" className="text-xs mt-1">
                    -{item.lineDiscountType === 'percentage' ? `${item.lineDiscount}%` : `$${item.lineDiscount}`}
                  </Badge>
              }
              </div>
              
              {/* Quantity Controls */}
              <div className="flex items-center gap-1">
                <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(item.id, -1)}
                className="h-8 w-8 p-0">

                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(item.id, 1)}
                className="h-8 w-8 p-0">

                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Item Total */}
              <div className="text-right">
                <p className="font-semibold text-sm">${item.subtotal.toFixed(2)}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                {canApplyDiscount &&
              <Dialog
                open={lineDiscountDialog.isOpen && lineDiscountDialog.itemId === item.id}
                onOpenChange={(open) => {
                  if (open) {
                    setLineDiscountDialog({
                      isOpen: true,
                      itemId: item.id,
                      currentDiscount: item.lineDiscount,
                      discountType: item.lineDiscountType
                    });
                  } else {
                    setLineDiscountDialog({ isOpen: false, itemId: '', currentDiscount: 0, discountType: 'percentage' });
                  }
                }}>

                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2">
                        <Percent className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Line Discount</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Discount Type</label>
                          <Select
                        value={lineDiscountDialog.discountType}
                        onValueChange={(value: 'percentage' | 'fixed') =>
                        setLineDiscountDialog((prev) => ({ ...prev, discountType: value }))
                        }>

                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Discount {lineDiscountDialog.discountType === 'percentage' ? '(%)' : '($)'}
                          </label>
                          <Input
                        type="number"
                        value={lineDiscountDialog.currentDiscount}
                        onChange={(e) =>
                        setLineDiscountDialog((prev) => ({
                          ...prev,
                          currentDiscount: parseFloat(e.target.value) || 0
                        }))
                        }
                        min="0"
                        max={lineDiscountDialog.discountType === 'percentage' ? 100 : item.subtotal}
                        step="0.01" />

                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                        variant="outline"
                        onClick={() => setLineDiscountDialog({ isOpen: false, itemId: '', currentDiscount: 0, discountType: 'percentage' })}>

                            Cancel
                          </Button>
                          <Button onClick={handleLineDiscount}>
                            Apply Discount
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
              }
                
                <Button
                variant="outline"
                size="sm"
                onClick={() => removeFromCart(item.id)}
                className="h-7 px-2">

                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Order Summary */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          
          {state.orderDiscount > 0 &&
          <div className="flex justify-between text-sm text-red-600">
              <span>Order Discount:</span>
              <span>-${orderDiscountAmount.toFixed(2)}</span>
            </div>
          }
          
          <div className="flex justify-between text-sm">
            <span>Tax:</span>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between font-semibold text-lg">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Order Discount Button */}
        {canApplyDiscount &&
        <Dialog
          open={orderDiscountDialog.isOpen}
          onOpenChange={(open) => setOrderDiscountDialog((prev) => ({ ...prev, isOpen: open }))}>

            <DialogTrigger asChild>
              <Button variant="outline" className="w-full mt-4">
                <DollarSign className="h-4 w-4 mr-2" />
                Order Discount
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Order Discount</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Discount Type</label>
                  <Select
                  value={orderDiscountDialog.discountType}
                  onValueChange={(value: 'percentage' | 'fixed') =>
                  setOrderDiscountDialog((prev) => ({ ...prev, discountType: value }))
                  }>

                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Discount {orderDiscountDialog.discountType === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <Input
                  type="number"
                  value={orderDiscountDialog.discount}
                  onChange={(e) =>
                  setOrderDiscountDialog((prev) => ({
                    ...prev,
                    discount: parseFloat(e.target.value) || 0
                  }))
                  }
                  min="0"
                  max={orderDiscountDialog.discountType === 'percentage' ? 100 : subtotal}
                  step="0.01" />

                </div>
                <div className="flex justify-end gap-2">
                  <Button
                  variant="outline"
                  onClick={() => setOrderDiscountDialog((prev) => ({ ...prev, isOpen: false }))}>

                    Cancel
                  </Button>
                  <Button onClick={handleOrderDiscount}>
                    Apply Discount
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      </CardContent>
    </Card>);

};

export default ShoppingCart;