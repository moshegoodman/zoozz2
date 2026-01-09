import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, AlertCircle, Loader2 } from "lucide-react";
import { useLanguage } from '../i18n/LanguageContext';

export default function ProductImportDialog({ isOpen, onClose, vendors, onImportComplete }) {
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [fileUploadProgress, setFileUploadProgress] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importData, setImportData] = useState([]);
  const [clientSkippedRows, setClientSkippedRows] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(isOpen);
  const { language } = useLanguage();

  useEffect(() => {
    setIsDialogOpen(isOpen);
  }, [isOpen]);

  // Client-side CSV parser function
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
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ''));

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

  // Helper function to find column value with flexible naming
  const getColumnValue = (row, possibleNames) => {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== '') {
        return row[name];
      }
    }
    return '';
  };

  // Process product data
  const processProductData = (product, vendorId) => {
    return {
      name: product.name?.trim() || '',
      name_hebrew: product.name_hebrew?.trim() || '',
      description: product.description?.trim() || '',
      description_hebrew: product.description_hebrew?.trim() || '',
      price_base: parseFloat(product.price_base) || 0,
      price_customer_app: parseFloat(product.price_customer_app) || 0,
      price_customer_kcs: parseFloat(product.price_customer_kcs) || 0,
      subcategory: product.subcategory?.trim() || '',
      subcategory_hebrew: product.subcategory_hebrew?.trim() || '',
      unit: product.unit ? product.unit.toLowerCase().trim() : 'each',
      quantity_in_unit: String(product.quantity_in_unit || '').trim(),
      stock_quantity: parseInt(product.stock_quantity) || 100,
      brand: product.brand?.trim() || '',
      brand_hebrew: product.brand_hebrew?.trim() || '',
      barcode: product.barcode?.trim() || '',
      kashrut: product.kashrut?.trim() || '',
      kashrut_hebrew: product.kashrut_hebrew?.trim() || '',
      image_url: product.image_url?.trim() || '',
      is_draft: product.is_draft === 'true' || product.is_draft === true,
      sku: product.sku?.trim() || '',
      vendor_id: vendorId
    };
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedVendor) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file.');
      return;
    }

    setIsFileUploading(true);
    setFileUploadProgress("Reading CSV file...");

    // Reset states for a new upload
    setImportData([]);
    setClientSkippedRows([]);
    setImportStatus("");

    try {
      const fileText = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });

      setFileUploadProgress("Parsing CSV data...");
      const parsedData = parseCSV(fileText);

      if (!parsedData || parsedData.length === 0) {
        alert("No valid data found in the CSV file.");
        setIsFileUploading(false);
        setFileUploadProgress("");
        return;
      }

      console.log(`Initial client-side processing for ${parsedData.length} products from CSV...`);

      let processedProductsForImport = [];
      const currentClientSkippedRows = [];
      const skusInFile = new Set();
      const barcodesInFile = new Set();

      for (const [index, row] of parsedData.entries()) {
        const rowNum = index + 2;
        let rowErrors = [];

        const sku = getColumnValue(row, ['sku', 'SKU', 'Sku']);
        const name = getColumnValue(row, ['Product_name_EN', 'name', 'product_name']);
        const price_base = getColumnValue(row, ['price_base', 'base_price', 'price']);
        const unit = getColumnValue(row, ['Product_UOM', 'unit','Unit', 'uom']);
        const barcode = getColumnValue(row, ['barcode', 'Barcode', 'EAN']);
        
        // Required fields check
        if (!sku || sku.trim() === '') {
          rowErrors.push('SKU is missing.');
        }
        if (!name || name.trim() === '') {
          rowErrors.push('Product Name is missing.');
        }
        if (!price_base || isNaN(parseFloat(price_base))) {
          rowErrors.push('Base Price is missing or invalid.');
        }

        if (rowErrors.length > 0) {
            currentClientSkippedRows.push({ rowNum, reason: rowErrors.join(' ') });
            continue;
        }
        
        const cleanSku = sku.trim();

        // Uniqueness check for SKU within the file
        if (skusInFile.has(cleanSku)) {
            currentClientSkippedRows.push({ rowNum, reason: `Duplicate SKU '${cleanSku}' in file.` });
            continue;
        }
        skusInFile.add(cleanSku);

        // Uniqueness check for Barcode within the file
        const cleanBarcode = barcode ? barcode.trim() : '';
        if (cleanBarcode && barcodesInFile.has(cleanBarcode)) {
            currentClientSkippedRows.push({ rowNum, reason: `Duplicate Barcode '${cleanBarcode}' in file.` });
            continue;
        }
        if (cleanBarcode) {
            barcodesInFile.add(cleanBarcode);
        }

        const rawProductData = {
          sku: cleanSku,
          name: getColumnValue(row, ['Product_name_EN', 'name', 'product_name']),
          name_hebrew: getColumnValue(row, ['Product_name_HE', 'name_hebrew', 'product_name_hebrew']),
          description: getColumnValue(row, ['description_EN', 'description']),
          description_hebrew: getColumnValue(row, ['description_HE', 'description_hebrew']),
          price_base: getColumnValue(row, ['price_base', 'base_price', 'price']),
          price_customer_app: getColumnValue(row, ['price_customer_app', 'customer_app_price']),
          price_customer_kcs: getColumnValue(row, ['price_customer_kcs', 'customer_kcs_price']),
          subcategory: getColumnValue(row, ['subcategory_EN', 'subcategory', 'category']),
          subcategory_hebrew: getColumnValue(row, ['subcategory_HE', 'subcategory_hebrew', 'category_hebrew']),
          unit: unit,
          quantity_in_unit: getColumnValue(row, [ 'quantity_in_unit', 'Product_Unit','unit_quantity']),
          brand: getColumnValue(row, ['brand_EN', 'brand']),
          brand_hebrew: getColumnValue(row, ['brand_HE', 'brand_hebrew']),
          stock_quantity: getColumnValue(row, ['stock_quantity', 'stock', 'inventory']),
          kashrut: getColumnValue(row, ['kashrut_EN', 'kashrut']),
          kashrut_hebrew: getColumnValue(row, ['kashrut_HE', 'kashrut_hebrew']),
          image_url: getColumnValue(row, ['image_url', 'image', 'photo_url','Product_image_url']),
          barcode: cleanBarcode,
          is_draft: getColumnValue(row, ['is_draft', 'Is_Draft', 'draft']),
        };
        processedProductsForImport.push(processProductData(rawProductData, selectedVendor));
      }

      setImportData(processedProductsForImport);
      setClientSkippedRows(currentClientSkippedRows);
      
      setFileUploadProgress(`Parsed ${processedProductsForImport.length} products. ${currentClientSkippedRows.length} rows skipped during file processing.`);
      
    } catch (error) {
      console.error("File upload and parsing error:", error);
      alert("Error reading or parsing file. Please check file format. Details in console.");
      setImportData([]);
      setClientSkippedRows([]);
    } finally {
      setIsFileUploading(false);
    }
  };

  const processImport = async () => {
    if (importData.length === 0 || !selectedVendor) {
      alert("No products to import or vendor not selected.");
      return;
    }

    setIsImporting(true);
    setImportStatus('Processing...');
    
    try {
      console.log(`Processing ${importData.length} products from CSV...`);
      setImportStatus("Loading existing products for comparison...");

      const { Product } = await import("@/entities/Product");
      const existingVendorProducts = await Product.filter({ vendor_id: selectedVendor });
      
      const existingSkuMap = new Map(
        existingVendorProducts
          .map(p => (p.sku ? [String(p.sku).trim(), p] : null))
          .filter(Boolean)
      );
      
      let productsToCreate = [];
      let productsToUpdatePayload = [];

      for (const product of importData) {
        const existingProduct = existingSkuMap.get(product.sku);

        if (existingProduct) {
          productsToUpdatePayload.push({ id: existingProduct.id, data: product });
        } else {
          productsToCreate.push(product);
        }
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedUpdateCount = 0;

      // Perform bulk create for new products
      if (productsToCreate.length > 0) {
        setImportStatus(`Creating ${productsToCreate.length} new products...`);
        const createResult = await Product.bulkCreate(productsToCreate);
        createdCount = createResult.length;
      }

      // Perform bulk update for existing products
      if (productsToUpdatePayload.length > 0) {
        setImportStatus(`Updating ${productsToUpdatePayload.length} existing products...`);
        const { bulkUpdateProducts } = await import("@/functions/bulkUpdateProducts");
        const updateResponse = await bulkUpdateProducts({ updates: productsToUpdatePayload });
        
        if (updateResponse.data?.success) {
            updatedCount = updateResponse.data.successCount;
            failedUpdateCount = updateResponse.data.failureCount;
            if (failedUpdateCount > 0) {
                console.warn("Some products failed to update:", updateResponse.data.results.filter(r => !r.success));
            }
        } else {
            throw new Error(updateResponse.data?.error || 'Bulk update request failed');
        }
      }
      
      setImportStatus("Import completed!");
      
      let summaryMessage = `Import successful!\n- ${createdCount} products created\n- ${updatedCount} products updated`;
      if (failedUpdateCount > 0) {
        summaryMessage += `\n- ${failedUpdateCount} products failed to update. Check console for details.`;
      }
      if (clientSkippedRows.length > 0) {
        summaryMessage += `\n- ${clientSkippedRows.length} rows skipped during file parsing.`;
        console.warn('Skipped rows during import:', clientSkippedRows);
      }
      alert(summaryMessage);

      if (onImportComplete) {
        onImportComplete();
      }

      // Reset after delay to show final status
      setTimeout(() => {
        setIsImporting(false);
        setImportData([]);
        setClientSkippedRows([]);
        setFileUploadProgress("");
        setImportStatus('');
        setIsDialogOpen(false);
        onClose();
      }, 3000);

    } catch (error) {
      console.error('Import process failed:', error);
      setImportStatus(`Import failed: ${error.message}`);
      alert(`Import failed: ${error.message || 'Unknown error'}. Details in console.`);
      setIsImporting(false);
    } finally {
      setIsFileUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'sku', 'subcategory_HE', 'subcategory_EN', 'Product_name_EN', 'Product_name_HE',
      'description_EN', 'description_HE',
      'Unit', 'Product_UOM', 'price_base', 'price_customer_app', 'price_customer_kcs',
      'image_url', 'stock_quantity', 'brand_HE', 'brand_EN', 'kashrut_HE', 'kashrut_EN',
      'barcode', 'is_draft'
    ];

    const sampleData = [
      'GLV-NIT-100',
      'כפפות',
      'Gloves',
      'Nitrile Gloves (100 pack)',
      'כפפות ניטריל (100 יחידות)',
      'Medical grade nitrile gloves, powder-free, ideal for sensitive skin.',
      'כפפות ניטריל רפואיות, ללא אבקה, אידיאליות לעור רגיש.',
      '100',
      'pack',
      '19.99',
      '19.99',
      '17.99',
      'https://images.unsplash.com/photo-1584303975595-3b1d319830c2',
      '50',
      'מותג הגנה',
      'Shield Brand',
      'אין',
      'None',
      '789123456001',
      'false'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'product_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleClose = (openStatus) => {
    if (openStatus === false) {
      if (!isImporting && !isFileUploading) {
        setSelectedVendor("");
        setImportData([]);
        setClientSkippedRows([]);
        setFileUploadProgress("");
        setImportStatus("");
        setIsDialogOpen(false);
        onClose();
      } else {
          alert("Please wait for the current process to complete before closing.");
          setIsDialogOpen(true); 
      }
    } else {
      setIsDialogOpen(true);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vendor Selection */}
          <div>
            <Label>Select Vendor *</Label>
            <Select 
              value={selectedVendor} 
              onValueChange={setSelectedVendor}
              disabled={isFileUploading || isImporting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose vendor..." />
              </SelectTrigger>
              <SelectContent>
                {vendors.map(vendor => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadTemplate}
                disabled={isFileUploading || isImporting}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isFileUploading || isImporting || !selectedVendor}
              key={isFileUploading ? 'uploading' : 'not-uploading-' + selectedVendor}
            />
            {fileUploadProgress && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                {fileUploadProgress}
              </div>
            )}
            {importData.length > 0 && !isFileUploading && !isImporting && (
                <p className="mt-2 text-sm text-green-700">
                    Ready to import {importData.length} products.
                    {clientSkippedRows.length > 0 && ` (${clientSkippedRows.length} rows skipped during client-side file parsing).`}
                </p>
            )}
             {clientSkippedRows.length > 0 && !isFileUploading && !isImporting && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 max-h-24 overflow-y-auto">
                    <p className="font-semibold">Client-side Skipped Rows:</p>
                    <ul className="list-disc list-inside">
                        {clientSkippedRows.map((row, idx) => (
                            <li key={idx}>Row {row.rowNum}: {row.reason}</li>
                        ))}
                    </ul>
                </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Expected format: <code>sku</code>, <code>Product_name_EN</code>, <code>price_base</code> (required), plus optional columns like <code>subcategory_EN</code>, <code>image_url</code>, etc.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Products with existing SKUs for the selected vendor will be updated, new SKUs will create new products. Leave <code>image_url</code> empty to preserve existing images.
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">How Importing Works:</h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>The <strong><code>sku</code></strong> column is a <strong>unique ID</strong> for each product. It's used to update existing products.</p>
                  <p>If you upload a file with a <code>sku</code> that already exists for this vendor, the product will be <strong>updated</strong>. If the <code>sku</code> is new, a new product will be <strong>created</strong>.</p>
                  <p>Column names are flexible - you can use variations like <code>SKU</code>, <code>Sku</code>, <code>name</code>, <code>product_name</code>, etc.</p>
                  <p className="font-medium text-red-700">Rows with missing required fields (SKU, Product Name, Base Price) or duplicate SKUs/Barcodes within the CSV file will be skipped.</p>
                </div>
              </div>
            </div>
          </div>

          {/* CSV Instructions */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">CSV Format:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Required fields: <code>sku</code>, <code>Product_name_EN</code> (or <code>name</code>), <code>price_base</code> (or <code>price</code>)</li>
              <li>The <code>Product_UOM</code> column (e.g., unit) can contain any string value to describe the product's unit.</li>
              <li>The parser handles quoted fields and various column name formats automatically</li>
              <li>Use the template for the correct format, but alternative column names will work too</li>
              <li>New optional fields: <code>description_EN</code>, <code>description_HE</code>, <code>barcode</code>, <code>is_draft</code> (use 'true' or 'false')</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center mt-6">
            {/* Import Status Display */}
            {(isFileUploading || isImporting) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isFileUploading ? fileUploadProgress : importStatus}</span>
                </div>
            )}
            
            {/* Buttons */}
            <div className="flex gap-2 ml-auto">
                <Button 
                    variant="outline" 
                    onClick={() => handleClose(false)}
                    disabled={isFileUploading || isImporting}
                >
                    Cancel
                </Button>
                <Button
                    onClick={processImport}
                    disabled={isImporting || isFileUploading || importData.length === 0 || !selectedVendor}
                >
                    {isImporting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                        </>
                    ) : (
                        "Start Import"
                    )}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}