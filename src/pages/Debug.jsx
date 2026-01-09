
import React, { useState, useEffect } from 'react';
import { User, Order, Vendor, Household } from '@/entities/all';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Bug, FileText, Loader2, Truck, Receipt } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';
import { generatePurchaseOrderPDF } from "@/functions/generatePurchaseOrderPDF";
import { debugPurchaseOrder } from "@/functions/debugPurchaseOrder";
import { generateDeliveryPDF } from "@/functions/generateDeliveryPDF";
import { generateInvoicePDF } from "@/functions/generateInvoicePDF";
import { generateInvoiceHTML } from "@/functions/generateInvoiceHTML";

export default function DebugPage() {
    const { t, language } = useLanguage();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    
    const [orderNumberInput, setOrderNumberInput] = useState('');
    const [isFetchingOrder, setIsFetchingOrder] = useState(false);
    const [fetchedOrder, setFetchedOrder] = useState(null);
    const [fetchedVendor, setFetchedVendor] = useState(null);
    const [fetchedHousehold, setFetchedHousehold] = useState(null);
    const [fetchError, setFetchError] = useState('');

    const [testingDeliveryPDF, setTestingDeliveryPDF] = useState(false);
    const [testingInvoicePDF, setTestingInvoicePDF] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                if (currentUser.user_type !== 'admin') {
                    setAccessDenied(true);
                }
            } catch (error) {
                setAccessDenied(true);
            } finally {
                setIsLoading(false);
            }
        };
        checkUser();
    }, []);

    const handleFetchOrder = async () => {
        if (!orderNumberInput.trim()) {
            setFetchError("Please enter an Order Number.");
            return;
        }
        setIsFetchingOrder(true);
        setFetchError('');
        setFetchedOrder(null);
        setFetchedVendor(null);
        setFetchedHousehold(null);
        try {
            const orders = await Order.filter({ order_number: orderNumberInput.trim() });
            if (orders.length === 0) {
                throw new Error("Order not found.");
            }
            const order = orders[0];
            setFetchedOrder(order);

            const [vendor, household] = await Promise.all([
                Vendor.get(order.vendor_id),
                order.household_id ? Household.get(order.household_id) : Promise.resolve(null)
            ]);
            setFetchedVendor(vendor);
            setFetchedHousehold(household);

        } catch (error) {
            setFetchError(error.message);
        } finally {
            setIsFetchingOrder(false);
        }
    };

    const handleTestPurchaseOrderHTML = async () => {
        if (!fetchedOrder) {
            alert("Please fetch an order first before running this test.");
            return;
        }
        alert("Attempting to generate test HTML. A new browser tab should open.");
        try {
            const response = await debugPurchaseOrder({
              order: fetchedOrder,
              vendor: fetchedVendor,
              household: fetchedHousehold,
              language,
              testType: 'html',
            });
            
            const htmlContent = response.data;
            const newWindow = window.open();
            if (newWindow) {
              newWindow.document.write(htmlContent);
              newWindow.document.close();
            } else {
              alert("Please allow pop-ups to view the test HTML.");
            }
        } catch (error) {
            console.error("Error testing HTML generation:", error);
            alert(`Failed to generate test HTML. Error: ${error.message}`);
        }
    };

    const handleTestInvoiceHTML = async () => {
        if (!fetchedOrder) {
            alert("Please fetch an order first before running this test.");
            return;
        }
        alert("Attempting to generate Invoice HTML. A new browser tab should open.");
        try {
            const response = await generateInvoiceHTML({
              order: fetchedOrder,
              vendor: fetchedVendor,
              language: language === 'Hebrew' ? 'he' : 'en'
            });
            
            const htmlContent = response.data;
            const newWindow = window.open();
            if (newWindow) {
              newWindow.document.write(htmlContent);
              newWindow.document.close();
            } else {
              alert("Please allow pop-ups to view the test HTML.");
            }
        } catch (error) {
            console.error("Error testing Invoice HTML generation:", error);
            alert(`Failed to generate Invoice HTML. Error: ${error.message}`);
        }
    };

    const handleTestPurchaseOrderPDF = async () => {
        if (!fetchedOrder) {
            alert("Please fetch an order first before running the PDF test.");
            return;
        }

        alert("Generating purchase order PDF using my_html2pdf. This will test the full flow: order data → HTML → PDF.");
        try {
            const response = await generatePurchaseOrderPDF({
                order: fetchedOrder,
                language: language
            });

            console.log("--- Purchase Order PDF Test Response ---", response);
            console.log("Response.data type:", typeof response.data);
            console.log("Response.data:", response.data);
            
            // Parse response if it's a string
            let responseData = response.data;
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (e) {
                    console.error("Failed to parse response data:", e);
                }
            }
            
            if (responseData && responseData.success && responseData.pdfBase64) {
                let cleanBase64 = responseData.pdfBase64;
                
                // Clean the base64 string
                if (typeof cleanBase64 === 'string') {
                    // Remove any whitespace
                    cleanBase64 = cleanBase64.replace(/\s/g, '');
                    
                    // Remove any quotes if present
                    cleanBase64 = cleanBase64.replace(/^["']|["']$/g, '');
                    
                    console.log("Cleaned base64 length:", cleanBase64.length);
                    console.log("Cleaned base64 first 50 chars:", cleanBase64.substring(0, 50));
                }
                
                try {
                    // Convert base64 to blob and download
                    const binaryString = atob(cleanBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
                    
                    const url = window.URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `PO-${fetchedOrder.order_number}-test.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    alert("PDF Test: Success! PDF downloaded. Check the console for full response details.");
                } catch (decodeError) {
                    console.error("Error decoding base64:", decodeError);
                    console.error("Base64 string causing error (first 100 chars):", cleanBase64.substring(0, 100));
                    alert(`Failed to decode PDF. Error: ${decodeError.message}. Check console for details.`);
                }
            } else if (responseData && !responseData.success) {
                alert(`PDF Test: Failed. ${responseData.error || 'Unknown error'}. Check console for details.`);
            } else {
                alert("PDF Test: Unexpected response format. Check console for details.");
            }

        } catch (error) {
            console.error("--- Error testing Purchase Order PDF ---", error);
            const errorDetails = error.response ? error.response.data : { message: error.message };
            console.error("Detailed Error Payload:", errorDetails);
            alert(`Failed to generate PDF. See the developer console for detailed error information.`);
        }
    };

    const handleTestDeliveryPDF = async () => {
        if (!fetchedOrder) {
            alert("Please fetch an order first.");
            return;
        }

        setTestingDeliveryPDF(true);
        try {
            console.log("--- Testing Delivery PDF Generation ---");
            const response = await generateDeliveryPDF({
                order: fetchedOrder,
                language: language
            });

            console.log("Delivery PDF Response:", response);

            // Parse response if it's a string
            let responseData = response.data;
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (e) {
                    console.error("Failed to parse response data:", e);
                }
            }

            if (responseData && responseData.success && responseData.pdfBase64) {
                let cleanBase64 = responseData.pdfBase64;
                
                // Clean the base64 string
                if (typeof cleanBase64 === 'string') {
                    cleanBase64 = cleanBase64.replace(/\s/g, '');
                    cleanBase64 = cleanBase64.replace(/^["']|["']$/g, '');
                }
                
                try {
                    const binaryString = atob(cleanBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
                    
                    const url = window.URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Delivery-${fetchedOrder.order_number}-test.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    alert("✅ Delivery PDF Test: Success! PDF downloaded.");
                } catch (decodeError) {
                    console.error("Error decoding base64:", decodeError);
                    alert(`Failed to decode Delivery PDF. Error: ${decodeError.message}`);
                }
            } else if (responseData && responseData.htmlContent) {
                // PDF generation failed but HTML was returned as fallback
                const htmlBlob = new Blob([responseData.htmlContent], { type: 'text/html' });
                const url = window.URL.createObjectURL(htmlBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Delivery-${fetchedOrder.order_number}-fallback.html`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                alert(`⚠️ Delivery PDF Test: PDF failed, HTML fallback downloaded. Error: ${responseData.error}`);
            } else {
                alert(`❌ Delivery PDF Test: Failed. ${responseData?.error || 'Unknown error'}.`);
            }

        } catch (error) {
            console.error("--- Error testing Delivery PDF ---", error);
            alert(`❌ Failed to generate Delivery PDF. ${error.message}`);
        } finally {
            setTestingDeliveryPDF(false);
        }
    };

    const handleTestInvoicePDF = async () => {
        if (!fetchedOrder) {
            alert("Please fetch an order first.");
            return;
        }

        setTestingInvoicePDF(true);
        try {
            console.log("--- Testing Invoice PDF Generation ---");
            console.log("Order:", fetchedOrder);
            console.log("Vendor:", fetchedVendor);
            console.log("Household:", fetchedHousehold);
            console.log("Language:", language);

            const response = await generateInvoicePDF({
                order: fetchedOrder,
                vendor: fetchedVendor,
                household: fetchedHousehold,
                language: language === 'Hebrew' ? 'he' : 'en'
            });

            console.log("=== Invoice PDF Full Response ===");
            console.log("Response object:", response);
            console.log("Response.data type:", typeof response.data);
            console.log("Response.data:", response.data);

            // Parse response if it's a string
            let responseData = response.data;
            if (typeof responseData === 'string') {
                console.log("Response data is string, attempting to parse...");
                try {
                    responseData = JSON.parse(responseData);
                    console.log("Parsed response data:", responseData);
                } catch (e) {
                    console.error("Failed to parse response data:", e);
                }
            }

            if (responseData && responseData.success && responseData.pdfBase64) {
                console.log("✅ Success flag is true, pdfBase64 exists");
                
                let cleanBase64 = responseData.pdfBase64;
                
                // Clean the base64 string thoroughly
                if (typeof cleanBase64 === 'string') {
                    cleanBase64 = cleanBase64.replace(/\s/g, '');
                    cleanBase64 = cleanBase64.replace(/^["']|["']$/g, '');
                    
                    console.log("Final cleaned base64 length:", cleanBase64.length);
                    console.log("Final cleaned base64 first 50 chars:", cleanBase64.substring(0, 50));
                }

                // Convert base64 to blob and download
                try {
                    const binaryString = atob(cleanBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
                    
                    console.log("PDF Blob created, size:", pdfBlob.size, "bytes");
                    
                    const url = window.URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Invoice-${fetchedOrder.order_number}-test.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    alert("✅ Invoice PDF Test: Success! PDF downloaded. Check the console for full detailed logs.");
                } catch (blobError) {
                    console.error("❌ Error creating blob or downloading:", blobError);
                    alert(`❌ Failed to create PDF blob: ${blobError.message}. Check console for details.`);
                }
            } else {
                console.error("❌ Response does not have success=true or pdfBase64");
                console.error("Response data:", responseData);
                alert(`❌ Invoice PDF Test: Failed. ${responseData?.error || 'Invalid response structure'}. Check console for details.`);
            }

        } catch (error) {
            console.error("--- Error testing Invoice PDF ---", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
            if (error.response) {
                console.error("Error response data:", error.response.data);
            }
            alert(`❌ Failed to generate Invoice PDF. See the developer console for detailed error information.`);
        } finally {
            setTestingInvoicePDF(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="animate-spin w-8 h-8" />
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="max-w-md mx-auto">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
                        <p className="text-gray-600">You must be an administrator to access this page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Debug Tools</h1>
            
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Order Data Fetcher</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>Enter an Order Number to fetch its data for debugging.</p>
                    <div className="flex items-center gap-2">
                        <Input 
                            placeholder="Enter Order Number (e.g., PO-D24...)"
                            value={orderNumberInput}
                            onChange={e => setOrderNumberInput(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleFetchOrder()}
                        />
                        <Button onClick={handleFetchOrder} disabled={isFetchingOrder}>
                            {isFetchingOrder ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Fetch Order'}
                        </Button>
                    </div>

                    {fetchError && <p className="text-red-600 text-sm">{fetchError}</p>}

                    {fetchedOrder && (
                        <Card className="bg-gray-50 mt-4">
                            <CardHeader>
                                <CardTitle className="text-lg">Fetched Order Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p><strong>Order #:</strong> {fetchedOrder.order_number}</p>
                                <p><strong>Vendor:</strong> {fetchedVendor?.name} ({fetchedVendor?.id})</p>
                                <p><strong>Household:</strong> {fetchedHousehold?.name || 'N/A'} ({fetchedHousehold?.id || 'N/A'})</p>
                                <p><strong>Items:</strong> {fetchedOrder.items.length}</p>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-8">Document Generation Tests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Purchase Order HTML Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Purchase Order HTML Test
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Generate and preview the Purchase Order HTML template in a new tab.
                        </p>
                        <Button 
                            onClick={handleTestPurchaseOrderHTML}
                            disabled={!fetchedOrder}
                            className="w-full"
                        >
                            Test HTML Generation
                        </Button>
                    </CardContent>
                </Card>

                {/* Invoice HTML Test - NEW */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Invoice HTML Test
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Generate and preview the Invoice HTML template in a new tab.
                        </p>
                        <Button 
                            onClick={handleTestInvoiceHTML}
                            disabled={!fetchedOrder}
                            className="w-full"
                        >
                            Test Invoice HTML
                        </Button>
                    </CardContent>
                </Card>

                {/* Purchase Order PDF Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Bug className="w-5 h-5" />
                            Purchase Order PDF Test
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Test the full Purchase Order PDF generation flow (order data → HTML → PDF).
                        </p>
                        <Button 
                            onClick={handleTestPurchaseOrderPDF}
                            disabled={!fetchedOrder}
                            className="w-full"
                        >
                            Test PDF Generation
                        </Button>
                    </CardContent>
                </Card>

                {/* Delivery PDF Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="w-5 h-5" />
                            Delivery PDF Test
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Test the generateDeliveryPDF backend function with the selected order.
                        </p>
                        <Button 
                            onClick={handleTestDeliveryPDF}
                            disabled={!fetchedOrder || testingDeliveryPDF}
                            className="w-full"
                        >
                            {testingDeliveryPDF ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Testing Delivery PDF...
                                </>
                            ) : (
                                <>
                                    <Truck className="w-4 h-4 mr-2" />
                                    Test Delivery PDF
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Invoice PDF Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Receipt className="w-5 h-5" />
                            Invoice PDF Test
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Test the generateInvoicePDF backend function with the selected order. Full debug logging enabled.
                        </p>
                        <Button 
                            onClick={handleTestInvoicePDF}
                            disabled={!fetchedOrder || testingInvoicePDF}
                            className="w-full"
                        >
                            {testingInvoicePDF ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Testing Invoice PDF...
                                </>
                            ) : (
                                <>
                                    <Receipt className="w-4 h-4 mr-2" />
                                    Test Invoice PDF
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
