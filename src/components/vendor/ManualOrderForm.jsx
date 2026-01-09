
import React, { useState, useEffect } from "react";
import { Order, User, Product, HouseholdStaff } from "@/entities/all";
import { SendEmail } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Search, X, ShoppingCart, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManualOrderForm({ isOpen, onClose, vendor, households, onOrderCreated }) {
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [customerData, setCustomerData] = useState(null); // This will hold the selected staff member's data, or null if no staff selected
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState({
    address: "",
    phone: "",
    deliveryTime: "ASAP",
    notes: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const resetForm = () => {
    setSelectedHouseholdId("");
    setSelectedHousehold(null);
    setHouseholdStaff([]);
    setSelectedStaffId("");
    setCustomerData(null);
    setOrderItems([]);
    setDeliveryDetails({
      address: "",
      phone: "",
      deliveryTime: "ASAP",
      notes: ""
    });
    setSearchQuery("");
    setIsLoading(false);
    setIsStaffLoading(false);
    setIsCreatingOrder(false);
  };

  useEffect(() => {
    if (isOpen) {
      // Only load if vendor and households data are available
      if (vendor && households) { 
        loadInitialData();
      }
    } else {
      resetForm();
    }
  }, [isOpen, vendor, households]); // Add vendor and households to dependency array

  const loadInitialData = async () => {
    // Ensure vendor object and its ID are available
    if (!vendor || !vendor.id) return; 
    setIsLoading(true);
    try {
      const vendorProducts = await Product.filter({ vendor_id: vendor.id });
      setProducts(vendorProducts);
      // Use the households prop directly instead of fetching
      setAllHouseholds(households); 
    } catch (error) {
      console.error("Error loading initial data for order form:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHouseholdSelect = async (householdId) => {
    setSelectedHouseholdId(householdId);
    
    // Reset staff and customer details
    setHouseholdStaff([]);
    setSelectedStaffId("");
    setCustomerData(null); // Clear customerData
    
    const household = allHouseholds.find(h => h.id === householdId);
    setSelectedHousehold(household);
    
    if (household) {
      // Auto-fill address from household
      setDeliveryDetails(prev => ({ ...prev, address: household.address || "" }));
      
      // Attempt to auto-fill phone from household owner if available
      let initialPhone = "";
      if (household.owner_user_id) {
        setIsStaffLoading(true); // Reusing this for owner fetch status
        try {
          const ownerUsers = await User.filter({ id: household.owner_user_id });
          if (ownerUsers.length > 0) {
            initialPhone = ownerUsers[0].phone || "";
          }
        } catch (error) {
          console.error("Error loading household owner:", error);
        } finally {
          setIsStaffLoading(false);
        }
      }
      setDeliveryDetails(prev => ({ ...prev, phone: initialPhone })); // Set initial phone

      // Load staff for the selected household
      setIsStaffLoading(true);
      try {
        const staffAssignments = await HouseholdStaff.filter({ household_id: household.id });
        if (staffAssignments.length > 0) {
          const staffUserIds = staffAssignments.map(staff => staff.staff_user_id);
          const allKCSUsers = await User.filter({ user_type: 'customerKCS' });
          const staffDetails = allKCSUsers.filter(user => staffUserIds.includes(user.id));
          setHouseholdStaff(staffDetails);
        }
      } catch (error) {
        console.error("Error loading staff for household:", error);
      } finally {
        setIsStaffLoading(false);
      }
    } else {
      // Clear details if household is deselected
      setDeliveryDetails(prev => ({ ...prev, address: "", phone: ""}));
    }
  };

  const handleStaffSelect = (staffId) => {
    setSelectedStaffId(staffId);
    const staffMember = householdStaff.find(s => s.id === staffId);
    if (staffMember) {
        setCustomerData(staffMember);
        // Autofill phone from selected staff member, overriding any previous value
        setDeliveryDetails(prev => ({ ...prev, phone: staffMember.phone || ""}));
    } else {
        // If staff is deselected (e.g., if there were a "None" option chosen, or initial state)
        setCustomerData(null);
        // Do not clear phone here, it should be either from owner or user manual input.
        // It's already handled by handleHouseholdSelect or manual input.
    }
  };

  const addProductToOrder = (product) => {
    const existingItem = orderItems.find(item => item.product_id === product.id);
    if (existingItem) {
      setOrderItems(prev => prev.map(item => 
        item.product_id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems(prev => [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_name_hebrew: product.name_hebrew, // Add product_name_hebrew
        quantity: 1,
        price: product.price_customer_kcs || product.price_base, // Keep KCS specific pricing
        unit: product.unit
      }]);
    }
  };

  const updateItemQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      setOrderItems(prev => prev.filter(item => item.product_id !== productId));
    } else {
      setOrderItems(prev => prev.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // For KCS customers, delivery fee is generally 0.
    const deliveryFee = 0; 
    const total = subtotal + deliveryFee;
    return { subtotal, deliveryFee, total };
  };

  // Generate order number with new format as per outline
  const generateOrderNumber = (vendorId, householdId) => {
    const now = new Date();
    const date = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD format
    const hour = now.getHours().toString().padStart(2, '0');
    
    // Get last 4 digits of vendor ID
    const vendorSuffix = vendorId.slice(-4);
    
    // Get last 4 digits of household ID
    const householdSuffix = householdId.slice(-4);
    
    // Generate running number (timestamp-based to ensure uniqueness)
    const runningNumber = now.getTime().toString().slice(-3);
    
    return `PO-D${date}-H${hour}-C${householdSuffix}-V${vendorSuffix}-${runningNumber}`;
  };

  const createOrder = async () => {
    if (!selectedHouseholdId || !selectedHousehold) { // Ensure selectedHousehold is not null for properties access
        alert("Please select a household first.");
        return;
    }
    
    if (orderItems.length === 0) {
      alert("Please add at least one item to the order.");
      return;
    }

    if (!deliveryDetails.address.trim()) {
      alert("Please fill in delivery address.");
      return;
    }

    if (!deliveryDetails.phone.trim()) {
      alert("Please fill in phone number.");
      return;
    }

    setIsCreatingOrder(true);
    try {
      let recipientUser = null; // This recipientUser is for notification emails.

      if (customerData) { // A specific staff member was selected
        recipientUser = customerData;
      } else if (selectedHousehold.owner_user_id) { // No staff selected, so find the household owner
        const ownerUsers = await User.filter({ id: selectedHousehold.owner_user_id });
        if (ownerUsers.length > 0) {
          recipientUser = ownerUsers[0];
        }
      } 
      
      if (!recipientUser) {
        alert("Cannot determine order recipient for notifications. Please select a staff member or ensure the household has an assigned owner.");
        setIsCreatingOrder(false);
        return;
      }
      
      const { subtotal } = calculateTotals();
      
      // Generate the order number using the new format
      const orderNumber = generateOrderNumber(vendor.id, selectedHousehold.id); // Pass vendor.id and selectedHousehold.id
      
      // Determine the user_email for the order record as per outline (household owner/fallback)
      const orderRecordUserEmail = selectedHousehold.owner_user_id ? 
        (await User.get(selectedHousehold.owner_user_id))?.email || `household-${selectedHousehold.id}@temp.com` :
        `household-${selectedHousehold.id}@temp.com`;


      const orderData = {
        order_number: orderNumber, // Use the newly generated order number
        user_email: orderRecordUserEmail, // Use the email derived for the order record from the outline
        vendor_id: vendor.id, // Use vendor.id from props
        household_id: selectedHouseholdId, // This correctly includes the household_id
        items: orderItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_name_hebrew: item.product_name_hebrew || null, // Keep null if not defined as per outline
          quantity: item.quantity,
          price: item.price, // Uses KCS specific pricing already handled
          unit: item.unit || 'each' // Add fallback as per outline
        })),
        total_amount: subtotal,
        delivery_fee: 0, // Explicitly 0 for KCS manual orders
        status: "pending",
        delivery_address: deliveryDetails.address,
        delivery_time: deliveryDetails.deliveryTime,
        phone: deliveryDetails.phone,
        delivery_notes: deliveryDetails.notes || ""
      };

      console.log('Creating manual order with data:', orderData); // Added from outline

      const createdOrder = await Order.create(orderData);

      // Verify the order was created with an order_number as per outline
      if (!createdOrder.order_number || !createdOrder.order_number.startsWith('PO-')) {
        console.error('Manual order created with incorrect order_number format:', createdOrder);
      }

      // --- Start of Email Logic ---
      // Use recipientUser for email sending, as this aligns with selected staff if any.
      const customerEmailBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #2E7D32; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">FreshCart</h1>
          </div>
          <div style="padding: 20px;">
            <h2 style="color: #2E7D32;">An Order for ${selectedHousehold?.name || 'your household'} has been Placed!</h2>
            <p>Hi ${recipientUser.full_name},</p>
            <p>An order has been manually placed for the <strong>${selectedHousehold?.name || 'household'}</strong> by <strong>${vendor.name}</strong>. You can find the full details below.</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Order Summary</h3>
              <p><strong>Order #:</strong> ${orderNumber}</p>
              <p><strong>For Household:</strong> ${selectedHousehold?.name}</p>
              <p><strong>Placed by:</strong> ${vendor.name}</p>
              <p><strong>Delivery Address:</strong> ${deliveryDetails.address}</p>
              <p><strong>Contact:</strong> ${deliveryDetails.phone}</p>
              <p><strong>Time Slot:</strong> ${deliveryDetails.deliveryTime}</p>
              ${deliveryDetails.notes ? `<p><strong>Delivery Notes:</strong> ${deliveryDetails.notes}</p>` : ''}
            </div>

            <h3 style="color: #333;">Items Ordered</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead style="background-color: #f2f2f2;">
                <tr>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Product</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Quantity</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${orderItems.map(item => `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.product_name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity} ${item.unit}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₪${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="text-align: right;">
               <p style="margin: 5px 0;">Subtotal: <strong>₪${subtotal.toFixed(2)}</strong></p>
               <p style="margin: 5px 0;">Delivery Fee: <strong>₪0.00</strong></p>
               <p style="font-size: 1.2em; margin: 10px 0 0;">Total: <strong style="color: #2E7D32;">₪${subtotal.toFixed(2)}</strong></p>
            </div>
          </div>
          <div style="background-color: #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #666;">
            <p>If you have questions, please contact ${vendor.name}.</p>
            <p>&copy; ${new Date().getFullYear()} FreshCart. All rights reserved.</p>
          </div>
        </div>
      `;

      // Send notification to vendor
      const itemsListHtml = orderItems.map(item => 
        `<li>${item.product_name} x ${item.quantity} ${item.unit} - ₪${(item.price * item.quantity).toFixed(2)}</li>`
      ).join('');
      
      const vendorEmailBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">FreshCart - New Order</h1>
            </div>
            <div style="padding: 20px;">
                <h2 style="color: #007bff;">🛒 New KCS Order Created - #${orderNumber}</h2>
                <p>Hi ${vendor.name} Team,</p>
                <p>You have successfully created a new KCS order through the FreshCart portal.</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Order Details</h3>
                    <p><strong>Order Number:</strong> ${orderNumber}</p>
                    <p><strong>Customer:</strong> ${recipientUser.full_name}</p>
                    <p><strong>Customer Email:</strong> ${recipientUser.email}</p>
                    <p><strong>Customer Phone:</strong> ${deliveryDetails.phone || 'Not provided'}</p>
                    <p><strong>Household:</strong> ${selectedHousehold?.name || 'N/A'}</p>
                    <p><strong>Delivery Address:</strong> ${deliveryDetails.address}</p>
                    <p><strong>Delivery Time:</strong> ${deliveryDetails.deliveryTime}</p>
                    ${deliveryDetails.notes ? `<p><strong>Delivery Notes:</strong> ${deliveryDetails.notes}</p>` : ''}
                </div>
                
                <div style="background-color: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                    <h4 style="margin-top: 0;">Items Ordered:</h4>
                    <ul style="list-style-type: none; padding: 0; margin: 0;">
                        ${itemsListHtml}
                    </ul>
                </div>

                <div style="text-align: right; margin-top: 20px;">
                    <p style="margin: 5px 0;">Subtotal: <strong>₪${subtotal.toFixed(2)}</strong></p>
                    <p style="margin: 5px 0;">Delivery Fee: <strong>₪0.00</strong> (KCS Order)</p>
                    <p style="font-size: 1.2em; margin: 10px 0 0;">Total Amount: <strong style="color: #007bff;">₪${subtotal.toFixed(2)}</strong></p>
                </div>
            </div>
            <div style="background-color: #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #666;">
              <p>&copy; ${new Date().getFullYear()} FreshCart. All rights reserved.</p>
            </div>
        </div>
      `;

      await Promise.all([
        SendEmail({
          to: recipientUser.email,
          subject: `Your KCS Order #${orderNumber} from ${vendor.name} is Confirmed`,
          body: customerEmailBody
        }),
        vendor.contact_email ? SendEmail({
          to: vendor.contact_email,
          subject: `🛒 New KCS Order #${orderNumber} - ${vendor.name}`,
          body: vendorEmailBody,
          from_name: "FreshCart Orders"
        }) : Promise.resolve() 
      ]);

      alert(`Order created successfully!`); // Simplified message as per outline
      
      onOrderCreated(); // Keep existing prop call without argument
      onClose(); // This will trigger the useEffect to reset the form
    } catch (error) {
      console.error("Error creating manual order:", error);
      alert("An error occurred while creating the order: " + error.message); // Updated message as per outline
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { subtotal, deliveryFee, total } = calculateTotals();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Order for KCS Household</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Household and Staff Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Household & Staff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="household-select">1. Select Household</Label>
                <Select
                  value={selectedHouseholdId}
                  onValueChange={handleHouseholdSelect}
                  disabled={isLoading}
                >
                  <SelectTrigger id="household-select">
                    <SelectValue placeholder={isLoading ? "Loading households..." : "Select a household"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allHouseholds.map(household => (
                      <SelectItem key={household.id} value={household.id}>
                        {household.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedHouseholdId && ( // Show staff selection and info section only if household is selected
                <>
                  <div>
                    <Label htmlFor="staff-select">2. Select Staff Member (Optional)</Label>
                    <Select
                      value={selectedStaffId}
                      onValueChange={handleStaffSelect}
                      disabled={isStaffLoading}
                    >
                      <SelectTrigger id="staff-select">
                          <SelectValue placeholder={
                              isStaffLoading ? "Loading staff..." : 
                              householdStaff.length === 0 ? "No staff found for this household" :
                              "Select a staff member"
                          } />
                      </SelectTrigger>
                      <SelectContent>
                          {householdStaff.map(staff => (
                              <SelectItem key={staff.id} value={staff.id}>
                                  <div className="flex flex-col">
                                    <span>{staff.full_name}</span>
                                    <span className="text-xs text-gray-500">{staff.email}</span>
                                  </div>
                              </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 mt-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800">KCS Premium Order</Badge>
                    </div>
                    <div>
                      <p className="text-sm">Ordering for: <span className="font-semibold">{selectedHousehold?.name}</span></p>
                      {customerData ? (
                        <p className="text-sm">Notifications will be sent to: <span className="font-semibold">{customerData.full_name}</span> ({customerData.email})</p>
                      ) : (
                        <p className="text-sm text-gray-600">Notifications will be sent to the household owner.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selectedHouseholdId && ( // Remaining sections appear if household is selected
            <>
              {/* Product Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Add Products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="border rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600">
                            ₪{(product.price_customer_kcs || product.price_base).toFixed(2)} / {product.unit}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => addProductToOrder(product)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              {orderItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Order Items ({orderItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {orderItems.map((item) => (
                        <div key={item.product_id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-gray-600">₪{item.price.toFixed(2)} / {item.unit}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-12 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateItemQuantity(item.product_id, 0)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-2 text-right">
                        <p>Subtotal: ₪{subtotal.toFixed(2)}</p>
                        {/* Displaying 0 delivery fee for KCS orders */}
                        <p>Delivery Fee: ₪0.00</p> 
                        <p className="font-bold text-lg">Total: ₪{subtotal.toFixed(2)}</p> {/* Total for KCS is subtotal */}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="address">Delivery Address</Label>
                    <Textarea
                      id="address"
                      value={deliveryDetails.address}
                      onChange={(e) => setDeliveryDetails(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Address auto-fills from household"
                      required
                      disabled // Address is derived from household, should be disabled for manual edit
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={deliveryDetails.phone}
                        onChange={(e) => setDeliveryDetails(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Phone auto-fills from selected recipient or household owner"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="deliveryTime">Delivery Time</Label>
                      <Select
                        value={deliveryDetails.deliveryTime}
                        onValueChange={(value) => setDeliveryDetails(prev => ({ ...prev, deliveryTime: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASAP">As soon as possible</SelectItem>
                          <SelectItem value="Today 09:00-11:00">Today 9:00-11:00 AM</SelectItem>
                          <SelectItem value="Today 11:00-13:00">Today 11:00 AM-1:00 PM</SelectItem>
                          <SelectItem value="Today 13:00-15:00">Today 1:00-3:00 PM</SelectItem>
                          <SelectItem value="Today 15:00-17:00">Today 3:00-5:00 PM</SelectItem>
                          <SelectItem value="Today 17:00-19:00">Today 5:00-7:00 PM</SelectItem>
                          <SelectItem value="Tomorrow 09:00-11:00">Tomorrow 9:00-11:00 AM</SelectItem>
                          <SelectItem value="Tomorrow 11:00-13:00">Tomorrow 11:00 AM-1:00 PM</SelectItem>
                          <SelectItem value="Tomorrow 13:00-15:00">Tomorrow 1:00-3:00 PM</SelectItem>
                          <SelectItem value="Tomorrow 15:00-17:00">Tomorrow 3:00-5:00 PM</SelectItem>
                          <SelectItem value="Tomorrow 17:00-19:00">Tomorrow 5:00-7:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={deliveryDetails.notes}
                      onChange={(e) => setDeliveryDetails(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g., Leave at back door, Call upon arrival"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Create Order Button */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={createOrder} disabled={isCreatingOrder} className="bg-green-600 hover:bg-green-700">
                  {isCreatingOrder ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    "Create Order"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
