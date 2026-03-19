import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, AlertCircle, Loader2, CheckCircle, XCircle, Minus } from "lucide-react";
import { useLanguage } from '../i18n/LanguageContext';
import { base44 } from '@/api/base44Client';

export default function ProductImportDialog({ isOpen, onClose, vendors, onImportComplete }) {
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [fileUploadProgress, setFileUploadProgress] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importData, setImportData] = useState([]);
  const [clientSkippedRows, setClientSkippedRows] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(isOpen);
  const [importReport, setImportReport] = useState(null); // null = no report yet
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

  const TRACKED_FIELDS = ['name', 'name_hebrew', 'price_base', 'price_customer_app', 'price_customer_kcs', 'subcategory', 'subcategory_hebrew', 'unit', 'quantity_in_unit', 'brand', 'brand_hebrew', 'barcode', 'kashrut', 'kashrut_hebrew', 'image_url', 'is_draft', 'stock_quantity', 'description', 'description_hebrew'];

  const getChangedFields = (existing, incoming) => {
    const changes = [];
    for (const field of TRACKED_FIELDS) {
      const oldVal = existing[field] ?? '';
      const newVal = incoming[field] ?? '';
      const oldStr = String(oldVal).trim();
      const newStr = String(newVal).trim();
      if (newStr !== '' && oldStr !== newStr) {
        changes.push({ field, from: oldStr || '(empty)', to: newStr });
      }
    }
    return changes;
  };

  const processImport = async () => {
    if (importData.length === 0 || !selectedVendor) {
      alert("No products to import or vendor not selected.");
      return;
    }

    setIsImporting(true);
    setImportReport(null);
    setImportStatus('Processing...');
    
    try {
      setImportStatus("Loading existing products for comparison...");

      let existingVendorProducts = [];
      try {
        existingVendorProducts = await base44.entities.Product.filter({ vendor_id: selectedVendor }) || [];
      } catch (error) {
        console.warn("Failed to load existing products, will treat all as new:", error);
        existingVendorProducts = [];
      }
      
      const existingSkuMap = new Map(
        existingVendorProducts
          .filter(p => p && p.sku)
          .map(p => [String(p.sku).trim(), p])
      );
      
      let productsToCreate = [];
      let productsToUpdatePayload = [];
      const reportRows = []; // { sku, name, action, changes, unchanged }

      for (const product of importData) {
        const existingProduct = existingSkuMap.get(product.sku);

        if (existingProduct) {
          const { vendor_id, sku, ...updateData } = product;
          
          if (!updateData.image_url || updateData.image_url.trim() === '') {
            delete updateData.image_url;
          }
          
          Object.keys(updateData).forEach(key => {
            if (updateData[key] === '' || updateData[key] === undefined || updateData[key] === null) {
              delete updateData[key];
            }
          });

          const changes = getChangedFields(existingProduct, product);
          reportRows.push({ sku: product.sku, name: product.name, action: 'update', changes });
          
          productsToUpdatePayload.push({ id: existingProduct.id, data: updateData });
        } else {
          productsToCreate.push(product);
          reportRows.push({ sku: product.sku, name: product.name, action: 'create', changes: [] });
        }
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedUpdateCount = 0;

      if (productsToCreate.length > 0) {
        setImportStatus(`Creating ${productsToCreate.length} new products...`);
        const createResult = await base44.entities.Product.bulkCreate(productsToCreate);
        createdCount = createResult.length;
      }

      if (productsToUpdatePayload.length > 0) {
        setImportStatus(`Updating ${productsToUpdatePayload.length} existing products...`);
        const updateResponse = await base44.functions.invoke('bulkUpdateProducts', { updates: productsToUpdatePayload });
        
        if (updateResponse.data?.success) {
          updatedCount = updateResponse.data.successCount;
          failedUpdateCount = updateResponse.data.failureCount;
        } else {
          throw new Error(updateResponse.data?.error || 'Bulk update request failed');
        }
      }
      
      setImportStatus("Import completed!");
      setImportReport({
        created: createdCount,
        updated: updatedCount,
        failed: failedUpdateCount,
        skipped: clientSkippedRows,
        rows: reportRows,
      });

      if (onImportComplete) onImportComplete();
      setIsImporting(false);

    } catch (error) {
      console.error('Import process failed:', error);
      setImportStatus(`Import failed: ${error.message}`);
      alert(`Import failed: ${error.message || 'Unknown error'}`);
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
        setImportReport(null);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Products
          </DialogTitle>
        </DialogHeader>

        {/* ── REPORT VIEW ── */}
        {importReport && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{importReport.created}</p>
                <p className="text-xs text-green-600 font-medium">Created</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{importReport.updated}</p>
                <p className="text-xs text-blue-600 font-medium">Updated</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{importReport.failed + importReport.skipped.length}</p>
                <p className="text-xs text-red-600 font-medium">Skipped / Failed</p>
              </div>
            </div>

            {/* Skipped rows */}
            {importReport.skipped.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-yellow-800 mb-1">Skipped rows ({importReport.skipped.length})</p>
                <ul className="text-xs text-yellow-700 space-y-0.5 max-h-24 overflow-y-auto">
                  {importReport.skipped.map((r, i) => (
                    <li key={i}>Row {r.rowNum}: {r.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Per-product detail */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 border-b">
                Product-level changes ({importReport.rows.length} products)
              </div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {importReport.rows.map((row, i) => (
                  <div key={i} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.action === 'create'
                        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : row.changes.length > 0
                          ? <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          : <Minus className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      <span className="text-sm font-medium text-gray-800 truncate">{row.name}</span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">SKU: {row.sku}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        row.action === 'create' ? 'bg-green-100 text-green-700'
                        : row.changes.length > 0 ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {row.action === 'create' ? 'NEW' : row.changes.length > 0 ? 'UPDATED' : 'NO CHANGE'}
                      </span>
                    </div>
                    {row.changes.length > 0 && (
                      <div className="mt-1 ml-6 space-y-0.5">
                        {row.changes.map((c, j) => (
                          <div key={j} className="text-xs text-gray-600 flex gap-1 flex-wrap">
                            <span className="font-medium text-gray-700">{c.field}:</span>
                            <span className="text-red-500 line-through">{c.from.length > 40 ? c.from.slice(0,40)+'…' : c.from}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600">{c.to.length > 40 ? c.to.slice(0,40)+'…' : c.to}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}

        {/* ── IMPORT FORM ── */}
        {!importReport && <div className="space-y-6">
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
        </div>}
      </DialogContent>
    </Dialog>
  );
}