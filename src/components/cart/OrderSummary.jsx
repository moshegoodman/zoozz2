
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { AlertCircle, CreditCard, Package, CalendarClock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { createStripeCheckout } from "@/functions/createStripeCheckout";
import { createPageUrl } from "@/utils";
import { format, isBefore, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { toIsraeliTime, isSameDayInIsrael, getCurrentIsraeliTime } from '../i18n/dateUtils';
import { formatPrice } from '../i18n/priceUtils';

export default function OrderSummary({
  subtotal,
  deliveryFee, // This prop will now be ignored for calculations, but kept for compatibility if other components rely on it.
  total,       // This prop will now be ignored for calculations, but kept for compatibility if other components rely on it.
  cartItems,
  vendor,
  user,
  shoppingForHousehold,
  onPlaceOrder,
  isPlacingOrder
}) {
  const { t, language } = useLanguage();

  // State for new delivery selection UI
  const [street, setStreet] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [householdNumber, setHouseholdNumber] = useState('');
  const [entranceCode, setEntranceCode] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // State for calendar and time slots
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState({});

  // State for payment
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Get the correct household context for KCS staff from session storage
  const selectedHousehold = useMemo(() => {
    if (user?.user_type === 'kcs staff'||user?.user_type === 'household owner' ) {
      try {
        return JSON.parse(sessionStorage.getItem('selectedHousehold') || 'null');
      } catch (e) {
        console.error("Failed to parse selectedHousehold from session storage:", e);
        return null;
      }
    }
    return null;
  }, [user?.user_type]);

  // Determine if user role/context allows placing orders
  const isPermittedByRole = useMemo(() => {
    if (!user) return false;
    if (user.user_type === 'kcs staff'||user.user_type === 'household owner') {
      return selectedHousehold && selectedHousehold.canOrder;
    }
    if (['vendor', 'picker', 'admin', 'chief of staff'].includes(user.user_type)) {
      return !!shoppingForHousehold;
    }
    return true;
  }, [user, selectedHousehold, shoppingForHousehold]);

  // Check if minimum order is met and calculate actual delivery fee from vendor
  const isOrderable = subtotal >= (vendor?.minimum_order || 0);
  const actualDeliveryFee = vendor?.delivery_fee || 0;
  const finalTotal = subtotal + actualDeliveryFee;

  // Final check for enabling the "Place Order" button
  const canPlaceOrderButton = isPermittedByRole && isOrderable && street && buildingNumber && phone && selectedDate && selectedSlot && !isPlacingOrder && !isProcessingPayment;

  // Calendar logic
  const firstDayOfMonth = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(firstDayOfMonth),
    end: endOfWeek(endOfMonth(currentDate))
  });

  // useEffect to populate available slots from vendor data
  useEffect(() => {
    if (vendor?.detailed_schedule) {
      // Parse detailed_schedule if it's a string (same logic as DeliverySchedule)
      let parsedSchedule;
      if (typeof vendor.detailed_schedule === 'string') {
        try {
          parsedSchedule = JSON.parse(vendor.detailed_schedule);
        } catch (error) {
          console.error('Error parsing detailed_schedule in OrderSummary:', error);
          parsedSchedule = {};
        }
      } else if (typeof vendor.detailed_schedule === 'object' && vendor.detailed_schedule !== null) {
        parsedSchedule = vendor.detailed_schedule;
      } else {
        parsedSchedule = {};
      }
      
      // Validate it's an object before using
      if (parsedSchedule && typeof parsedSchedule === 'object' && !Array.isArray(parsedSchedule)) {
        setAvailableSlots(parsedSchedule);
      } else {
        console.warn('Invalid detailed_schedule format in OrderSummary');
        setAvailableSlots({});
      }
    } else {
      setAvailableSlots({});
    }
  }, [vendor]);

  // useEffect to populate address fields from context
  useEffect(() => {
    const currentContextHousehold = (user?.user_type === 'kcs staff' || user?.user_type === 'household owner') ? selectedHousehold : shoppingForHousehold;
    if (currentContextHousehold) {
      setStreet(currentContextHousehold.street || '');
      setBuildingNumber(currentContextHousehold.building_number || '');
      setHouseholdNumber(currentContextHousehold.household_number || '');
      setEntranceCode(currentContextHousehold.entrance_code || '');
      setNeighborhood(currentContextHousehold.neighborhood || '');
      setPhone(currentContextHousehold.lead_phone || user?.phone || '');
      setDeliveryNotes(currentContextHousehold.instructions || '');
    } else if (user) {
      setStreet(user.address || '');
      setPhone(user.phone || '');
      setDeliveryNotes(user.delivery_instructions || '');
    }
  }, [user, selectedHousehold, shoppingForHousehold]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const formatSlotTime = (timeString) => {
    if (!timeString || !timeString.includes(':')) return 'Invalid Time';
    const [hour, minute] = timeString.split(':');
    const date = new Date(2000, 0, 1, parseInt(hour), parseInt(minute));
    return format(date, 'h:mm a');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canPlaceOrderButton) return;

    const deliveryDetailsPayload = {
      street,
      building_number: buildingNumber,
      household_number: householdNumber,
      entrance_code: entranceCode,
      neighborhood,
      phone,
      notes: deliveryNotes,
      time: `${format(selectedDate, 'yyyy-MM-dd')} ${selectedSlot.start}-${selectedSlot.end}`
    };

    if (paymentMethod === 'stripe') {
      setIsProcessingPayment(true);
      try {
        const orderData = {
          vendor_id: vendor.id,
          household_id: shoppingForHousehold?.id || selectedHousehold?.id || null,
          items: cartItems,
          total_amount: finalTotal, // Use the new finalTotal
          delivery_fee: actualDeliveryFee, // Use the new actualDeliveryFee
          delivery_details: deliveryDetailsPayload,
          payment_method: 'stripe',
          language: language // Pass current language to lock currency
        };

        const baseUrl = window.location.origin;
        const response = await createStripeCheckout({
          orderData,
          successUrl: `${baseUrl}${createPageUrl('PaymentSuccess')}`,
          cancelUrl: `${baseUrl}${createPageUrl('Cart')}`
        });

        if (response.data?.url) {
          window.top.location.href = response.data.url;
        } else {
          throw new Error("Stripe session URL not received.");
        }
      } catch (error) {
        console.error('Stripe payment initiation failed:', error);
        alert(`${t('errors.stripeErrorTitle', 'Payment Error')}: ${error.message || 'Unknown error'}`);
      } finally {
        setIsProcessingPayment(false);
      }
    } else {
      // Cash on delivery - call onPlaceOrder directly
      // onPlaceOrder will need to be updated in Cart.js to accept these new total/delivery_fee
      // or to derive them similarly, or this component could pass them through to onPlaceOrder.
      // For now, assuming onPlaceOrder handles getting the correct totals itself, or this component's
      // responsibility is just for payment initiation. Let's pass the calculated values for consistency.
      await onPlaceOrder({
        ...deliveryDetailsPayload,
        total_amount: finalTotal,
        delivery_fee: actualDeliveryFee,
        payment_method: 'cash',
        language: language // Pass current language to lock currency
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          {t('orderSummary.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Conditional rendering for the summary section */}
          {user?.user_type !== "kcs staff" && user?.user_type !== "household owner" && (
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('orderSummary.subtotal')}</span>
                <span className="font-medium">{formatPrice(subtotal, language)}</span>
              </div>
              {actualDeliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('orderSummary.deliveryFee')}</span>
                  <span className="font-medium">{formatPrice(actualDeliveryFee, language)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="text-lg font-bold">{t('orderSummary.total')}</span>
                <span className="text-lg font-bold text-green-600">{formatPrice(finalTotal, language)}</span>
              </div>
              {vendor?.minimum_order > 0 && subtotal < vendor.minimum_order && (
                <p className="text-xs text-amber-600">
                  {t('orderSummary.minimumOrderWarning', { amount: formatPrice(vendor.minimum_order, language) })}
                </p>
              )}
            </div>
          )}

          {!isOrderable && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <p>{t('orderSummary.minimumOrderWarning', { amount: formatPrice(vendor?.minimum_order || 0, language) })}</p>
            </Alert>
          )}

          <div className="space-y-3">
            <Label className="text-base font-semibold">{t('orderSummary.deliveryAddressDetails')}</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder={t('orderSummary.streetPlaceholder')} value={street} onChange={(e) => setStreet(e.target.value)} required />
                <Input placeholder={t('orderSummary.buildingNumberPlaceholder')} value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} required />
                <Input placeholder={t('orderSummary.householdNumberPlaceholder')} value={householdNumber} onChange={(e) => setHouseholdNumber(e.target.value)} />
                <Input placeholder={t('orderSummary.entranceCodePlaceholder')} value={entranceCode} onChange={(e) => setEntranceCode(e.target.value)} />
                <Input className="md:col-span-2" placeholder={t('orderSummary.neighborhoodPlaceholder')} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone-number">{t('orderSummary.phoneNumber')}</Label>
            <Input id="phone-number" placeholder={t('orderSummary.phoneNumberPlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="w-4 h-4" />
              {t('orderSummary.selectDeliveryTime')}
            </Label>
            <div className="p-3 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold text-sm">{format(currentDate, 'MMMM yyyy')}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => <div key={index} className="font-semibold text-gray-500">{d}</div>)}
                  {calendarDays.map((date) => {
                    const israeliDate = toIsraeliTime(date);
                    const dateKey = format(israeliDate, 'yyyy-MM-dd');
                    const isAvailable = !!availableSlots[dateKey] && availableSlots[dateKey].length > 0;
                    const isSelected = selectedDate && isSameDayInIsrael(date, selectedDate);
                    const isPast = isBefore(israeliDate, getCurrentIsraeliTime()); // Compare dates in Israeli time
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    return (
                      <button
                        type="button"
                        key={dateKey}
                        onClick={() => handleDateSelect(date)}
                        disabled={!isAvailable || isPast}
                        className={`w-8 h-8 rounded-full transition-colors text-xs ${!isCurrentMonth ? 'text-gray-300' : ''} ${isPast && isCurrentMonth ? 'text-gray-400 line-through' : ''} ${isAvailable && !isPast ? 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer' : ''} ${!isAvailable && isCurrentMonth && !isPast ? 'text-gray-400' : ''} ${isSelected ? '!bg-green-600 text-white font-bold' : ''}`}
                      >
                        {format(date, 'd')}
                      </button>
                    );
                  })}
                </div>
            </div>
          </div>

          {selectedDate && (
            <div className="space-y-2 pt-2">
              <Label>{t('orderSummary.availableSlotsFor', { date: format(selectedDate, 'MMM d') })}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const israeliDate = toIsraeliTime(selectedDate);
                  const dateKey = format(israeliDate, 'yyyy-MM-dd');
                  return (availableSlots[dateKey] || []).map((slot, i) => (
                    <Button
                      type="button"
                      key={i}
                      variant={selectedSlot === slot ? "default" : "outline"}
                      onClick={() => setSelectedSlot(slot)}
                      className={`text-sm ${selectedSlot === slot ? 'bg-green-600' : 'border-green-300 text-green-800'}`}
                    >
                      {formatSlotTime(slot.start)} - {formatSlotTime(slot.end)}
                    </Button>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="delivery-notes">{t('orderSummary.deliveryNotes')}</Label>
            <Textarea id="delivery-notes" placeholder={t('orderSummary.deliveryNotesPlaceholder')} value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={2} />
          </div>

      <div className="space-y-2 border-t pt-4">
             <h4 className="font-semibold text-base">{t('orderSummary.paymentMethod')}</h4>
             <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={(e) => setPaymentMethod(e.target.value)} className="form-radio h-4 w-4 text-green-600"/>
                <span>{t('cart.cashOnDelivery')}</span>
              </label>
              {user?.user_type ==='admin' &&  <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="paymentMethod" value="stripe" checked={paymentMethod === 'stripe'} onChange={(e) => setPaymentMethod(e.target.value)} className="form-radio h-4 w-4 text-green-600"/>
                  <span><CreditCard className="w-4 h-4 inline mr-1" /> {t('cart.creditCard')}</span>
              </label>}

            </div>
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={!canPlaceOrderButton}>
            {(isPlacingOrder || isProcessingPayment) ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('orderSummary.processingPayment', 'Processing Payment...')}</>
            ) : (
              paymentMethod === 'stripe' ? (
                <><CreditCard className="w-4 h-4 mr-2" /> {t('orderSummary.payWithCard', 'Pay with Card')}</>
              ) : (
                t('cart.placeOrder')
              )
            )}
          </Button>

        </form>
      </CardContent>
    </Card>
  );
}
