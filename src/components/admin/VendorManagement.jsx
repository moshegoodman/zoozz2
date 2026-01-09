
import React, { useState, useEffect } from "react";
import { Vendor, Product } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Store, Plus, Edit, Package, X, Crown, Trash2, Upload, FileImage, GripVertical, Download, Image as ImageIcon, Loader2, User as UserIcon, Mail, Phone, Truck, Save } from "lucide-react";
import ProductManagement from "../vendor/ProductManagement";
import ProductImportDialog from "./ProductImportDialog";
import { deleteVendorProducts } from "@/functions/deleteVendorProducts";
import { UploadFile } from "@/integrations/Core"; // Import UploadFile integration
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from "../i18n/LanguageContext";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const mainCategories = [
    { value: 'produce', label: 'Produce' },
    { value: 'dairy', label: 'Dairy' },
    { value: 'meat', label: 'Meat' },
    { value: 'poultry', label: 'Poultry' },
    { value: 'fish', label: 'Fish' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'pantry', label: 'Pantry' },
    { value: 'frozen', label: 'Frozen' },
    { value: 'beverages', label: 'Beverages' },
    { value: 'snacks', label: 'Snacks' },
    { value: 'household', label: 'Household' },
    { value: 'disposables', label: 'Disposables' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'personal_care', label: 'Personal Care' }
];

export default function VendorManagement({ vendors, users, onVendorUpdate, user }) {
  const { t, language } = useLanguage();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isDeletingProducts, setIsDeletingProducts] = useState(null); // New state for product deletion
  const [currentVendorProducts, setCurrentVendorProducts] = useState([]);
  const [selectedVendorForProducts, setSelectedVendorForProducts] = useState(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState(""); // New state for subcategory input
  const [subcategoriesArray, setSubcategoriesArray] = useState([]); // For ordering
  const isRTL = language === 'Hebrew';
  const [isUploading, setIsUploading] = useState(false); // New state for image upload
  const [isExporting, setIsExporting] = useState(false); // New state for vendor export

  // New state for inline delivery fee editing
  const [editingDeliveryFee, setEditingDeliveryFee] = useState(null);
  const [tempDeliveryFee, setTempDeliveryFee] = useState('');
  const [isSavingDeliveryFee, setIsSavingDeliveryFee] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    name_hebrew: "",
    description: "",
    main_category: "",
    subcategories: "",
    kcs_exclusive: false,
    image_url: "", // Add image_url to form data
    delivery_fee: 0, // Add delivery_fee to form data
    has_vat: true // New field: Does the vendor charge VAT?
  });

  useEffect(() => {
    if (!isFormOpen) return;

    // Get current subcategories from formData (string) and filter out empty strings
    const currentSubsInForm = formData.subcategories.split(',').map(s => s.trim()).filter(Boolean);

    setSubcategoriesArray(prevArray => {
      let newArray = [];
      
      // Add items from prevArray if they are still in currentSubsInForm, preserving their order
      prevArray.forEach(sub => {
        if (currentSubsInForm.includes(sub)) {
          newArray.push(sub);
        }
      });

      // Add any new subcategories from currentSubsInForm that are not yet in newArray
      currentSubsInForm.forEach(sub => {
        if (!newArray.includes(sub)) {
          newArray.push(sub);
        }
      });
      return newArray;
    });
  }, [formData.subcategories, isFormOpen]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(subcategoriesArray);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSubcategoriesArray(items);
  };

  // Generic input change handler for text/number inputs
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };


// Simple CSV parser function
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }

  return rows;
};

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Add retry logic for file uploads
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          const { file_url } = await UploadFile({ file });
          setFormData(prev => ({ ...prev, image_url: file_url }));
          return; // Success - exit the function
        } catch (error) {
          lastError = error;
          retries--;
          
          // If it's a timeout error (status 544 or 500), wait before retrying
          if (error.response?.status === 500 || error.response?.status === 544) {
            if (retries > 0) {
              console.log(`Upload failed, retrying... (${retries} attempts left)`);
              // Wait 2 seconds before retry
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          } else {
            // For non-timeout errors, don't retry
            throw error;
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError;
      
    } catch (error) {
      console.error("Error uploading image:", error);
      
      // Provide more specific error messages
      if (error.response?.status === 544) {
        alert(t('common.databaseTimeoutError') || 'Database timeout - please try again in a moment');
      } else if (error.response?.status === 500) {
        alert(t('common.serverError') || 'Server error - please try again in a moment');
      } else {
        alert(t('common.uploadError') || 'Upload failed - please try again');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubcategoryAdd = () => {
    if (!newSubcategory.trim()) return;
    // Parse current subcategories string into an array, filter out empty strings
    const currentSubs = formData.subcategories.split(',').map(s => s.trim()).filter(Boolean);
    // Check for duplicates (case-insensitive)
    if (currentSubs.some(s => s.toLowerCase() === newSubcategory.trim().toLowerCase())) {
        setNewSubcategory(''); // Clear input if duplicate
        return;
    }

    const newSubs = [...currentSubs, newSubcategory.trim()];
    setFormData(prev => ({ ...prev, subcategories: newSubs.join(', ') }));
    setNewSubcategory(''); // Clear input field
  };

  const handleSubcategoryRemove = (subToRemove) => {
    // Parse current subcategories string into an array, filter out empty strings
    const currentSubs = formData.subcategories.split(',').map(s => s.trim()).filter(Boolean);
    // Filter out the subcategory to remove (case-insensitive)
    const newSubs = currentSubs.filter(s => s.toLowerCase() !== subToRemove.toLowerCase());
    setFormData(prev => ({ ...prev, subcategories: newSubs.join(', ') }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Get all unique subcategories from the current form input
      const allUniqueSubcategories = Array.from(new Set(
        formData.subcategories
          .split(',')
          .map(s => s.trim())
          .filter(s => s) // Remove empty strings
      ));

      // Prepare data for saving
      const dataToSave = {
        name: formData.name,
        name_hebrew: formData.name_hebrew,
        description: formData.description,
        main_category: formData.main_category,
        kcs_exclusive: formData.kcs_exclusive,
        image_url: formData.image_url, // Include image_url in data to save
        // Store all unique subcategories
        subcategories: allUniqueSubcategories,
        // Store the admin-defined order, ensuring only valid subcategories are included
        subcategory_order: subcategoriesArray.filter(sub => allUniqueSubcategories.includes(sub)),
        delivery_fee: parseFloat(formData.delivery_fee) || 0, // Include delivery_fee
        has_vat: formData.has_vat // Include has_vat
      };

      if (editingVendor) {
        await Vendor.update(editingVendor.id, dataToSave);
      } else {
        await Vendor.create(dataToSave);
      }
      
      setIsFormOpen(false);
      setEditingVendor(null);
      setFormData({
        name: "",
        name_hebrew: "",
        description: "",
        main_category: "",
        subcategories: "",
        kcs_exclusive: false,
        image_url: "", // Reset image_url
        delivery_fee: 0, // Reset delivery_fee
        has_vat: true // Reset has_vat
      });
      setNewSubcategory(""); // Reset new subcategory input field as well
      setSubcategoriesArray([]);
      await onVendorUpdate();
    } catch (error) {
      console.error("Error saving vendor:", error);
      alert(t('admin.vendorManagement.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);

    // CRITICAL: Handle subcategory order correctly for editing
    const allSubs = vendor.subcategories || [];
    const adminOrder = vendor.subcategory_order || [];
    
    // Start with the admin-defined order
    let finalOrder = [...adminOrder];
    
    // Add any subcategories that exist but aren't in the admin order
    allSubs.forEach(sub => {
        if (!finalOrder.includes(sub)) {
            finalOrder.push(sub);
        }
    });
    
    // Remove any items from the order that no longer exist in subcategories
    finalOrder = finalOrder.filter(sub => allSubs.includes(sub));
    
    setSubcategoriesArray(finalOrder);

    setFormData({
      name: vendor.name,
      name_hebrew: vendor.name_hebrew || "",
      description: vendor.description || "",
      main_category: vendor.main_category || "",
      subcategories: allSubs.join(", "),
      kcs_exclusive: vendor.kcs_exclusive || false,
      image_url: vendor.image_url || "", // Populate image_url on edit
      delivery_fee: vendor.delivery_fee || 0, // Populate delivery_fee on edit
      has_vat: vendor.has_vat !== undefined ? vendor.has_vat : true // Populate has_vat on edit, default to true
    });
    setIsFormOpen(true);
  };
  
  const handleDeleteVendor = async (vendor) => {
    if (window.confirm(t('admin.vendorManagement.deleteVendorConfirm', { name: vendor.name }))) {
        setIsDeleting(vendor.id);
        try {
            // 1. Find all products associated with the vendor
            const productsToDelete = await Product.filter({ vendor_id: vendor.id });
            
            // 2. Delete all found products sequentially to avoid rate limiting
            if (productsToDelete.length > 0) {
                for (const product of productsToDelete) {
                    await Product.delete(product.id);
                }
            }

            // 3. Delete the vendor
            await Vendor.delete(vendor.id);
            
            alert(t('admin.vendorManagement.deleteSuccess', { name: vendor.name }));
            
            // 4. Refresh the list
            await onVendorUpdate();

        } catch (error) {
            console.error("Error deleting vendor and products:", error);
            alert(t('admin.vendorManagement.deleteError'));
        } finally {
            setIsDeleting(null);
        }
    }
  };
  
  const handleManageProducts = async (vendor) => {
      setSelectedVendorForProducts(vendor);
      const products = await Product.filter({ vendor_id: vendor.id });
      setCurrentVendorProducts(products);
  };
  
  const handleProductUpdate = async () => {
    if (selectedVendorForProducts) {
        const products = await Product.filter({ vendor_id: selectedVendorForProducts.id });
        setCurrentVendorProducts(products);
    }
  };

  const getProductCount = async (vendorId) => {
    try {
      const products = await Product.filter({ vendor_id: vendorId });
      return products.length;
    } catch {
      return 0;
    }
  };

  const handleDeleteAllProducts = async (vendor) => {
    const productCount = await getProductCount(vendor.id);
    if (window.confirm(t('admin.vendorManagement.deleteAllConfirm', { name: vendor.name, count: productCount }))) {
      setIsDeletingProducts(vendor.id);
      try {
        // NEW: Call the backend function instead of client-side loop
        const response = await deleteVendorProducts({ vendor_id: vendor.id });
        
        if (response.data.success) {
          alert(t('admin.vendorManagement.deleteAllSuccess', { count: response.data.count, name: vendor.name }));
        } else {
          throw new Error(response.data.error || 'Unknown error occurred.');
        }
        
        // Refresh data
        await onVendorUpdate();
        // If the product management dialog is open for this vendor, refresh its contents
        if (selectedVendorForProducts?.id === vendor.id) {
          await handleProductUpdate();
        }

      } catch (error) {
        console.error("Error deleting all products:", error);
        alert(t('admin.vendorManagement.deleteAllError') + `: ${error.message}`);
      } finally {
        setIsDeletingProducts(null);
      }
    }
  };

  const handleExportProducts = async (vendor) => {
    try {
      // Get all products for this vendor
      const products = await Product.filter({ vendor_id: vendor.id });
      
      if (products.length === 0) {
        alert(t('admin.vendorManagement.noProductsToExport', { name: vendor.name }));
        return;
      }

      // Create CSV content with the exact format that import expects
      const headers = [
        'sku',
        'name',
        'name_hebrew',
        'description', 
        'description_hebrew',
        'price_base',
        'price_customer_app',
        'price_customer_kcs',
        'subcategory',
        'subcategory_hebrew',
        'unit',
        'quantity_in_unit',
        'stock_quantity',
        'brand',
        'brand_hebrew',
        'barcode',
        'kashrut',
        'kashrut_hebrew',
        'image_url',
        'is_draft'
      ];

      const csvContent = [
        headers.join(','),
        ...products.map(product => [
          product.sku || '',
          `"${(product.name || '').replace(/"/g, '""')}"`,
          `"${(product.name_hebrew || '').replace(/"/g, '""')}"`,
          `"${(product.description || '').replace(/"/g, '""')}"`,
          `"${(product.description_hebrew || '').replace(/"/g, '""')}"`,
          product.price_base !== undefined && product.price_base !== null ? product.price_base : '',
          product.price_customer_app !== undefined && product.price_customer_app !== null ? product.price_customer_app : '',
          product.price_customer_kcs !== undefined && product.price_customer_kcs !== null ? product.price_customer_kcs : '',
          `"${(product.subcategory || '').replace(/"/g, '""')}"`,
          `"${(product.subcategory_hebrew || '').replace(/"/g, '""')}"`,
          product.unit || 'each',
          product.quantity_in_unit !== undefined && product.quantity_in_unit !== null ? product.quantity_in_unit : '',
          product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : '',
          `"${(product.brand || '').replace(/"/g, '""')}"`,
          `"${(product.brand_hebrew || '').replace(/"/g, '""')}"`,
          product.barcode || '',
          product.kashrut || '',
          product.kashrut_hebrew || '',
          product.image_url || '',
          product.is_draft ? 'true' : 'false'
        ].join(','))
      ].join('\n');

      // Create and download file with UTF-8 BOM
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${vendor.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_products_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(t('admin.vendorManagement.exportSuccess', { count: products.length, name: vendor.name }));

    } catch (error) {
      console.error('Error exporting products:', error);
      alert(t('admin.vendorManagement.exportError'));
    }
  };

  const handleExportVendors = () => {
    setIsExporting(true);
    try {
      const headers = [
        'ID', 'Name', 'Name (Hebrew)', 'Owner Name', 'Owner Email', 'Owner Phone',
        'Main Category', 'Subcategories', 'KCS Exclusive', 'Image URL', 'Delivery Fee', 'Has VAT'
      ];
      
      const csvContent = [
        headers.join(','),
        ...vendors.map(vendor => {
          const owner = users?.find(u => u.email === vendor.contact_email);
          const subcategories = vendor.subcategory_order?.length > 0
            ? vendor.subcategory_order.join('; ')
            : (vendor.subcategories || []).join('; ');

          return [
            vendor.id,
            `"${(vendor.name || '').replace(/"/g, '""')}"`,
            `"${(vendor.name_hebrew || '').replace(/"/g, '""')}"`,
            `"${(owner?.full_name || 'N/A').replace(/"/g, '""')}"`,
            owner?.email || 'N/A',
            owner?.phone || 'N/A', // Added Owner Phone here
            mainCategories.find(c => c.value === vendor.main_category)?.label || vendor.main_category || '',
            `"${subcategories.replace(/"/g, '""')}"`,
            vendor.kcs_exclusive ? 'Yes' : 'No',
            vendor.image_url || '',
            vendor.delivery_fee !== undefined && vendor.delivery_fee !== null ? vendor.delivery_fee : '0', // Add Delivery Fee
            vendor.has_vat ? 'Yes' : 'No' // Add Has VAT
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `vendors_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting vendors:", error);
      alert(t('admin.vendorManagement.exportVendorsError') || 'Error exporting vendors.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditDeliveryFee = (vendor) => {
    setEditingDeliveryFee(vendor.id);
    setTempDeliveryFee(vendor.delivery_fee?.toString() || '0');
  };

  const handleSaveDeliveryFee = async (vendorId) => {
    setIsSavingDeliveryFee(true);
    try {
      const deliveryFee = parseFloat(tempDeliveryFee) || 0;
      await Vendor.update(vendorId, { delivery_fee: deliveryFee });
      setEditingDeliveryFee(null);
      setTempDeliveryFee('');
      await onVendorUpdate();
    } catch (error) {
      console.error("Error updating delivery fee:", error);
      alert(t('admin.vendorManagement.deliveryFeeUpdateError') || 'Failed to update delivery fee');
    } finally {
      setIsSavingDeliveryFee(false);
    }
  };

  const handleCancelDeliveryFee = () => {
    setEditingDeliveryFee(null);
    setTempDeliveryFee('');
  };

  return (
    <Card dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            {t('admin.vendorManagement.title')}
          </CardTitle>
          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExportVendors} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {t('admin.vendorManagement.exportVendors')}
            </Button>
            <Link to={createPageUrl("ImageMatcher")}>
              <Button variant="outline" size="sm">
                <FileImage className="w-4 h-4 mr-2" />
                {t('admin.vendorManagement.matchImages')}
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              {t('admin.vendorManagement.importProducts')}
            </Button>
            <Button
              onClick={() => {
                setEditingVendor(null); // Clear editing state for adding new vendor
                setFormData({ // Reset form for new vendor
                  name: "",
                  name_hebrew: "",
                  description: "",
                  main_category: "",
                  subcategories: "",
                  kcs_exclusive: false,
                  image_url: "", // Reset image_url for new vendor
                  delivery_fee: 0, // Reset delivery_fee for new vendor
                  has_vat: true // Reset has_vat for new vendor
                });
                setNewSubcategory(""); // Clear new subcategory input
                setSubcategoriesArray([]); // Clear ordered subcategories
                setIsFormOpen(true); // Open the dialog
              }}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('admin.vendorManagement.addVendor')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ProductImportDialog
            isOpen={isImportDialogOpen}
            onClose={() => setIsImportDialogOpen(false)}
            vendors={vendors}
            onImportComplete={onVendorUpdate}
        />
        {/* Vendor Add/Edit Dialog */}
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingVendor(null); }}>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVendor ? t('admin.vendorManagement.editVendor') : t('admin.vendorManagement.addNewVendor')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="name">{t('admin.vendorManagement.vendorNameEn')}</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleFormChange} required />
              </div>
              <div>
                <Label htmlFor="name_hebrew">{t('admin.vendorManagement.vendorNameHe')}</Label>
                <Input 
                  id="name_hebrew" 
                  name="name_hebrew" 
                  value={formData.name_hebrew} 
                  onChange={handleFormChange} 
                  style={{ direction: 'rtl' }}
                  placeholder={t('admin.vendorManagement.vendorNameHePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="description">{t('admin.vendorManagement.description')}</Label>
                <Textarea id="description" name="description" value={formData.description} onChange={handleFormChange} />
              </div>
              <div>
                <Label htmlFor="image_url">{t('admin.vendorManagement.storeImage')}</Label>
                <div className="mt-2 flex items-center gap-4">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Vendor" className="w-20 h-20 rounded-md object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-md bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-grow">
                    <Input
                      id="image-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <Button type="button" onClick={() => document.getElementById('image-upload-input').click()} disabled={isUploading} variant="outline">
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {isUploading ? t('common.uploading') : t('common.uploadImage')}
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">{t('admin.vendorManagement.imageUploadHint')}</p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="main_category">{t('admin.vendorManagement.mainCategory')}</Label>
                <Select
                  name="main_category"
                  value={formData.main_category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, main_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.vendorManagement.selectMainCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subcategories-input">{t('admin.vendorManagement.subcategories')}</Label>
                <div className="flex gap-2 mb-2">
                    <Input
                        id="subcategories-input"
                        placeholder={t('admin.vendorManagement.addSubcategoryPlaceholder')}
                        value={newSubcategory}
                        onChange={(e) => setNewSubcategory(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubcategoryAdd(); }}}
                    />
                    <Button type="button" onClick={handleSubcategoryAdd}>{t('admin.vendorManagement.add')}</Button>
                </div>
                <p className="text-xs text-gray-500 mb-2">{t('admin.vendorManagement.dragToReorder')}</p>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="subcategories-droppable">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="p-2 bg-gray-50 rounded-md min-h-[80px] border border-gray-200 space-y-1">
                                {subcategoriesArray.map((sub, index) => (
                                    <Draggable key={sub} draggableId={sub} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className="flex items-center justify-between bg-white p-2 rounded shadow-sm border gap-2"
                                            >
                                                <div className="flex items-center gap-2 flex-grow min-w-0">
                                                    <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                    <span className="break-words">{sub}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSubcategoryRemove(sub)}
                                                    className="rounded-full hover:bg-gray-200 p-1 transition-colors flex-shrink-0"
                                                >
                                                    <X className="w-4 h-4 text-gray-500" />
                                                </button>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                                {subcategoriesArray.length === 0 && (
                                    <p className="text-sm text-gray-500 italic p-2">{t('admin.vendorManagement.noSubcategories')}</p>
                                )}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
              </div>
              {/* Delivery Fee Input */}
              <div>
                <Label htmlFor="delivery_fee">{t('admin.vendorManagement.deliveryFee')}</Label>
                <div className="flex items-center">
                  <span className="text-sm">₪</span>
                  <Input
                    id="delivery_fee"
                    name="delivery_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.delivery_fee}
                    onChange={handleFormChange}
                    className="w-full"
                    required
                  />
                </div>
              </div>
              {/* VAT Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_vat"
                  name="has_vat"
                  checked={formData.has_vat}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_vat: checked }))}
                />
                <Label htmlFor="has_vat">{t('admin.vendorManagement.hasVAT', 'Charges VAT (Value Added Tax)')}</Label>
              </div>
              {/* Checkbox for kcs_exclusive */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kcs_exclusive"
                  name="kcs_exclusive"
                  checked={formData.kcs_exclusive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, kcs_exclusive: checked }))}
                />
                <Label htmlFor="kcs_exclusive">{t('admin.vendorManagement.kcsExclusive')}</Label>
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsFormOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                  {isSubmitting ? t('common.saving') : (editingVendor ? t('common.update') : t('common.add'))}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* List of Vendors */}
        <div className="space-y-4">
          {vendors.map((vendor) => {
            const owner = users?.find(u => u.email === vendor.contact_email);
            const isEditingThisDeliveryFee = editingDeliveryFee === vendor.id;
            
            return (
              <div key={vendor.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    {vendor.image_url ? (
                      <img src={vendor.image_url} alt={vendor.name} className="w-16 h-16 rounded-md object-cover hidden sm:block"/>
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center hidden sm:block flex-shrink-0">
                        <Store className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      {/* Display kcs_exclusive badge and new has_vat badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{vendor.name}</p>
                        {vendor.name_hebrew && <p className="font-semibold text-gray-500 text-right">{vendor.name_hebrew}</p>}
                        {vendor.kcs_exclusive && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            {t('admin.vendorManagement.kcsOnly')}
                          </Badge>
                        )}
                        {vendor.has_vat === false && (
                          <Badge className="bg-orange-100 text-orange-800 text-xs">
                            {t('admin.vendorManagement.noVAT', 'No VAT')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{vendor.description}</p>
                      {/* Display main category and subcategories */}
                      {vendor.main_category && (
                        <p className="text-xs text-gray-500">
                          {t('admin.vendorManagement.category')}: <span className="font-medium">{mainCategories.find(c => c.value === vendor.main_category)?.label || vendor.main_category}</span>
                        </p>
                      )}
                      {vendor.subcategory_order && vendor.subcategory_order.length > 0 ? (
                        <p className="text-xs text-gray-500">
                          {t('admin.vendorManagement.subcategories')}: <span className="font-medium">{vendor.subcategory_order.join(", ")}</span>
                        </p>
                      ) : (
                        vendor.subcategories && vendor.subcategories.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {t('admin.vendorManagement.subcategories')}: <span className="font-medium">{vendor.subcategories.join(", ")}</span>
                          </p>
                        )
                      )}
                      
                      {/* Delivery Fee Display/Edit */}
                      <div className="mt-2 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">{t('admin.vendorManagement.deliveryFee')}:</span>
                        {isEditingThisDeliveryFee ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              <span className="text-sm">₪</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tempDeliveryFee}
                                onChange={(e) => setTempDeliveryFee(e.target.value)}
                                className="w-20 h-7 text-sm mx-1"
                                disabled={isSavingDeliveryFee}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleSaveDeliveryFee(vendor.id)}
                              disabled={isSavingDeliveryFee}
                            >
                              {isSavingDeliveryFee ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                              onClick={handleCancelDeliveryFee}
                              disabled={isSavingDeliveryFee}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-green-600">
                              ₪{(vendor.delivery_fee || 0).toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                              onClick={() => handleEditDeliveryFee(vendor)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Display owner info */}
                      {owner && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3 h-3"/>
                            <span className="font-medium">{t('admin.vendorManagement.owner')}:</span>
                            <span>{owner.full_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3"/>
                            <span className="font-medium">{t('admin.vendorManagement.contactEmail')}:</span>
                            <span>{owner.email}</span>
                          </div>
                          {owner.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3"/>
                              <span className="font-medium">{t('admin.vendorManagement.ownerPhone')}:</span>
                              <span>{owner.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                  <Dialog>
                      <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleManageProducts(vendor)}>
                              <Package className="w-4 h-4 mr-2" /> {t('admin.vendorManagement.products')}
                          </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                              <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <span>{t('admin.vendorManagement.manageProductsTitle', { name: selectedVendorForProducts?.name })}</span>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteAllProducts(selectedVendorForProducts)}
                                  disabled={isDeletingProducts === selectedVendorForProducts?.id}
                                >
                                  {isDeletingProducts === selectedVendorForProducts?.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  ) : (
                                    <Trash2 className="w-4 h-4 mr-2" />
                                  )}
                                  {t('admin.vendorManagement.deleteAllProducts')}
                                </Button>
                              </DialogTitle>
                          </DialogHeader>
                          {selectedVendorForProducts && (
                              <ProductManagement
                                  products={currentVendorProducts}
                                  vendorId={selectedVendorForProducts.id}
                                  onProductUpdate={handleProductUpdate}
                                  userType={user?.user_type}
                              />
                          )}
                      </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportProducts(vendor)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('admin.vendorManagement.exportProducts')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(vendor)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteVendor(vendor)}
                    disabled={isDeleting === vendor.id}
                  >
                    {isDeleting === vendor.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
