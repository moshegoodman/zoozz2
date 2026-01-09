import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Image as ImageIcon, AlertCircle, CheckCircle2, Store } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { Vendor } from '@/entities/all';
import { useEffect } from 'react';

export default function BulkImageUploader() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const vendorData = await Vendor.list();
        setVendors(vendorData);
      } catch (error) {
        console.error('Error loading vendors:', error);
      }
    };
    loadVendors();
  }, []);

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    setUploadResults([]);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    if (!selectedVendor) {
      alert('Please select a vendor for these images');
      return;
    }

    setUploading(true);
    setUploadResults([]);

    const results = [];
    
    for (const file of files) {
      try {
        const result = await UploadFile({ file });
        results.push({
          filename: file.name,
          url: result.file_url,
          status: 'success'
        });
      } catch (error) {
        results.push({
          filename: file.name,
          status: 'error',
          error: error.message
        });
      }
    }

    setUploadResults(results);
    setUploading(false);
  };

  const generateCSV = () => {
    if (uploadResults.length === 0) {
      alert('No upload results to generate CSV from');
      return;
    }

    const selectedVendorData = vendors.find(v => v.id === selectedVendor);
    const vendorName = selectedVendorData ? selectedVendorData.name : '';

    const successResults = uploadResults.filter(result => result.status === 'success');
    
    if (successResults.length === 0) {
      alert('No successful uploads to generate CSV from');
      return;
    }

    // Generate CSV with vendor information
    const headers = ['product_name', 'image_url', 'vendor_id', 'vendor_name'];
    const rows = successResults.map(result => {
      // Extract product name from filename (remove extension and clean up)
      const productName = result.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
      
      return [
        `"${productName}"`,
        `"${result.url}"`,
        `"${selectedVendor}"`,
        `"${vendorName}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${vendorName.replace(/[^a-zA-Z0-9]/g, '_')}_image_mapping.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Image Uploader</h1>
          <p className="text-gray-600">
            Upload multiple images at once and generate a CSV file for the Image Matcher.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Vendor Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Select Vendor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="vendor-select">Choose the vendor these images belong to:</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a vendor..." />
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
                {selectedVendor && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      Selected: <strong>{vendors.find(v => v.id === selectedVendor)?.name}</strong>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      All uploaded images will be associated with this vendor in the CSV file.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">Select image files:</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="mt-2"
                    disabled={!selectedVendor}
                  />
                  {!selectedVendor && (
                    <p className="text-sm text-orange-600 mt-1">
                      Please select a vendor first before choosing files.
                    </p>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Selected Files ({files.length}):</h3>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {files.map((file, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleUpload} 
                  disabled={files.length === 0 || uploading || !selectedVendor}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading {files.length} files...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {files.length} Files
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Upload Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {uploadResults.map((result, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          result.status === 'success' 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        {result.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{result.filename}</p>
                          {result.status === 'success' ? (
                            <p className="text-sm text-green-600">Successfully uploaded</p>
                          ) : (
                            <p className="text-sm text-red-600">Failed: {result.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900">
                        {uploadResults.filter(r => r.status === 'success').length} of {uploadResults.length} files uploaded successfully
                      </p>
                      <p className="text-sm text-blue-700">
                        Generate a CSV file to use with the Image Matcher
                      </p>
                    </div>
                    <Button 
                      onClick={generateCSV}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Generate CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to use</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <p>Select the vendor that these images belong to</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <p>Choose multiple image files to upload at once</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <p>Click "Upload" to upload all files to the cloud</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <p>Generate a CSV file that includes vendor information</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                  <p>Use the CSV file with the Image Matcher to automatically assign images to products</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}