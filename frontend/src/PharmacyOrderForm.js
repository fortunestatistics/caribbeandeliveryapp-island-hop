import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import CurrencyConverter from './CurrencyConverter';
import { Badge } from './components/ui/badge';
import { 
  Pill, 
  MapPin, 
  Upload,
  Plus,
  Minus,
  Trash2,
  Clock,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

const PharmacyOrderForm = () => {
  const navigate = useNavigate();
  const [orderType, setOrderType] = useState('otc'); // 'otc' or 'prescription'
  const [orderData, setOrderData] = useState({
    deliveryAddress: '',
    deliveryInstructions: '',
    urgency: 'standard',
    prescriptionFiles: [],
    items: []
  });

  const popularMedications = [
    { id: 1, name: 'Pain Relief (Paracetamol)', price: 8.50, category: 'Pain Relief', image: '💊' },
    { id: 2, name: 'Cold & Flu Medicine', price: 12.00, category: 'Cold & Flu', image: '🤧' },
    { id: 3, name: 'Vitamins Multi-Pack', price: 15.00, category: 'Vitamins', image: '💪' },
    { id: 4, name: 'First Aid Kit', price: 25.00, category: 'First Aid', image: '🩹' },
    { id: 5, name: 'Antacid Tablets', price: 9.00, category: 'Digestive', image: '💊' },
    { id: 6, name: 'Allergy Medicine', price: 14.00, category: 'Allergy', image: '🤧' },
    { id: 7, name: 'Bandages & Gauze', price: 7.50, category: 'First Aid', image: '🩹' },
    { id: 8, name: 'Hand Sanitizer', price: 5.00, category: 'Hygiene', image: '🧴' }
  ];

  const addItem = (medication) => {
    const existingItem = orderData.items.find(item => item.id === medication.id);
    if (existingItem) {
      updateItemQuantity(medication.id, existingItem.quantity + 1);
    } else {
      setOrderData(prev => ({
        ...prev,
        items: [...prev.items, { ...medication, quantity: 1 }]
      }));
    }
  };

  const updateItemQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    setOrderData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    }));
  };

  const removeItem = (itemId) => {
    setOrderData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setOrderData(prev => ({
      ...prev,
      prescriptionFiles: [...prev.prescriptionFiles, ...files]
    }));
  };

  const removeFile = (index) => {
    setOrderData(prev => ({
      ...prev,
      prescriptionFiles: prev.prescriptionFiles.filter((_, i) => i !== index)
    }));
  };

  const calculateSubtotal = () => {
    return orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateDeliveryFee = () => {
    if (orderData.urgency === 'urgent') return 15.00;
    if (orderData.urgency === 'express') return 10.00;
    return 5.00;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateDeliveryFee();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (orderType === 'prescription' && orderData.prescriptionFiles.length === 0) {
      alert('Please upload your prescription');
      return;
    }

    if (orderData.items.length === 0 && orderType === 'otc') {
      alert('Please add items to your order');
      return;
    }

    const pharmacyOrder = {
      service_type: 'pharmacy',
      order_type: orderType,
      ...orderData,
      subtotal: calculateSubtotal(),
      delivery_fee: calculateDeliveryFee(),
      total: calculateTotal()
    };

    navigate('/checkout', { state: { orderData: pharmacyOrder, serviceType: 'pharmacy' } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          ← Back to Home
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center">
              <Pill className="h-8 w-8 mr-3 text-neon-cyan" />
              Pharmacy Delivery
            </CardTitle>
            <p className="text-muted-foreground mt-2">Order medications and health products with prescription or over-the-counter</p>
          </CardHeader>
          <CardContent>
            {/* Order Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  orderType === 'otc'
                    ? 'border-2 border-blue-500 bg-neon-cyan/10'
                    : 'border border-border'
                }`}
                onClick={() => setOrderType('otc')}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-2">💊</div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">Over-the-Counter</h3>
                  <p className="text-sm text-muted-foreground">Shop vitamins, pain relief, and health products</p>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  orderType === 'prescription'
                    ? 'border-2 border-blue-500 bg-neon-cyan/10'
                    : 'border border-border'
                }`}
                onClick={() => setOrderType('prescription')}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-2">📋</div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">Prescription</h3>
                  <p className="text-sm text-muted-foreground">Upload prescription for prescribed medications</p>
                </CardContent>
              </Card>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Prescription Upload (if prescription order) */}
              {orderType === 'prescription' && (
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-neon-cyan/10">
                  <div className="flex items-start space-x-3">
                    <ShieldCheck className="h-6 w-6 text-neon-cyan flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-2">Upload Prescription</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload a clear photo or scan of your prescription. Our licensed pharmacist will verify it before processing.
                      </p>
                      
                      <Label htmlFor="prescription-upload" className="cursor-pointer">
                        <div className="flex items-center justify-center w-full py-4 px-4 border-2 border-blue-400 border-dashed rounded-lg hover:bg-neon-cyan/15 transition-colors">
                          <Upload className="h-5 w-5 mr-2 text-neon-cyan" />
                          <span className="text-neon-cyan font-semibold">Choose Files</span>
                          <Input
                            id="prescription-upload"
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </div>
                      </Label>

                      {orderData.prescriptionFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {orderData.prescriptionFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-card p-3 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <span className="text-2xl">📄</span>
                                <span className="text-sm text-foreground/90">{file.name}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* OTC Products (if over-the-counter order) */}
              {orderType === 'otc' && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Popular Medications & Products</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {popularMedications.map((med) => (
                      <Card key={med.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="text-center mb-3">
                            <div className="text-4xl mb-2">{med.image}</div>
                            <Badge className="mb-2 bg-neon-cyan/15 text-neon-cyan">{med.category}</Badge>
                            <h4 className="font-semibold text-sm text-foreground">{med.name}</h4>
                            <p className="text-lg font-bold text-neon-cyan mt-2">${med.price.toFixed(2)}</p>
                          </div>
                          <Button
                            type="button"
                            className="w-full bg-gradient-to-r from-neon-cyan to-gold-500 text-white"
                            onClick={() => addItem(med)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Order
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Cart Summary */}
              {orderData.items.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Your Order</h3>
                  <div className="space-y-3">
                    {orderData.items.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{item.image}</span>
                              <div>
                                <h4 className="font-semibold text-foreground">{item.name}</h4>
                                <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2 bg-matte-800 rounded-lg p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold px-2">{item.quantity}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <span className="font-bold text-foreground w-20 text-right">
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(item.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Delivery Details */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-neon-cyan" />
                  Delivery Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deliveryAddress">Delivery Address</Label>
                    <Input
                      id="deliveryAddress"
                      placeholder="123 Main Street, Kingston, Jamaica"
                      value={orderData.deliveryAddress}
                      onChange={(e) => setOrderData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryInstructions">Delivery Instructions (Optional)</Label>
                    <Input
                      id="deliveryInstructions"
                      placeholder="Apartment number, gate code, etc."
                      value={orderData.deliveryInstructions}
                      onChange={(e) => setOrderData(prev => ({ ...prev, deliveryInstructions: e.target.value }))}
                    />
                  </div>

                  {/* Delivery Urgency */}
                  <div>
                    <Label className="mb-2 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Delivery Speed
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: 'standard', name: 'Standard', time: '2-4 hours', fee: 5.00 },
                        { id: 'express', name: 'Express', time: '1-2 hours', fee: 10.00 },
                        { id: 'urgent', name: 'Urgent', time: '30-60 mins', fee: 15.00 }
                      ].map((option) => (
                        <Card
                          key={option.id}
                          className={`cursor-pointer transition-all ${
                            orderData.urgency === option.id
                              ? 'border-2 border-blue-500 bg-neon-cyan/10'
                              : 'border border-border hover:shadow-md'
                          }`}
                          onClick={() => setOrderData(prev => ({ ...prev, urgency: option.id }))}
                        >
                          <CardContent className="p-4 text-center">
                            <h4 className="font-semibold text-foreground">{option.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{option.time}</p>
                            <p className="text-sm font-semibold text-neon-cyan mt-2">+${option.fee.toFixed(2)}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-gold-500/10 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Important Information</p>
                    <p>• Prescription orders require verification by our licensed pharmacist</p>
                    <p>• You may be contacted for additional information</p>
                    <p>• Prescription medications require ID verification upon delivery</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="bg-matte-800 border border-gold-500/30 p-6 rounded-lg shadow-gold-glow">
                <div className="space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="text-foreground">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Fee:</span>
                    <span className="text-foreground">${calculateDeliveryFee().toFixed(2)}</span>
                  </div>
                  <Separator className="bg-gold-500/30" />
                  <div className="flex justify-between items-center pt-1 gap-3 flex-wrap">
                    <span className="text-lg font-semibold text-white">Total</span>
                    <CurrencyConverter amountUSD={calculateTotal()} size="lg" />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full text-lg py-6"
                disabled={orderType === 'otc' && orderData.items.length === 0}
              >
                Continue to Checkout
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PharmacyOrderForm;
