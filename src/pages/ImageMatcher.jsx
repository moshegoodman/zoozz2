
import React, { useState, useEffect, useCallback } from 'react';
import { Product, Vendor } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle2, AlertCircle, Store, Search, Check, X } from 'lucide-react';

export default function ImageMatcher() {
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [matchResults, setMatchResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, matched: 0, updated: 0, failed: 0 });
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [showingApprovals, setShowingApprovals] = useState(false);

  const loadVendors = useCallback(async () => {
    try {
      const vendorData = await Vendor.list();
      setVendors(vendorData);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  }, []); // Empty dependency array means this function is stable and only created once

  const loadProducts = useCallback(async () => {
    // If 'all' or 'auto' is selected, we don't pre-load products here.
    // Products will be loaded specifically in processMatching if needed.
    if (selectedVendor === 'all' || selectedVendor === 'auto') {
      setProducts([]);
      return;
    }
    try {
      const productsData = await Product.filter({ vendor_id: selectedVendor });
      setProducts(productsData || []); // Ensure productsData is an array
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]); // Clear products on error
    }
  }, [selectedVendor]); // Depends on selectedVendor, so the function changes when selectedVendor changes

  useEffect(() => {
    loadVendors();
  }, [loadVendors]); // useEffect now depends on the memoized loadVendors

  useEffect(() => {
    loadProducts();
  }, [loadProducts]); // useEffect now depends on the memoized loadProducts

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV file must have at least a header row and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
        const row = { _rowIndex: index + 2 }; // +2 because we start from line 2 (header is line 1)
        
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        
        return row;
      });

      setCsvData(data);
      
      // Check if CSV has vendor information
      const hasVendorInfo = headers.includes('vendor_id') || headers.includes('vendor_name');
      if (hasVendorInfo) {
        setSelectedVendor('auto'); // Special value to indicate auto-detection
      } else {
        setSelectedVendor('all'); // Reset to 'all' if no vendor info in CSV
      }
      
      setMatchResults([]);
      setPendingApprovals([]); // Clear approvals on new file upload
      setShowingApprovals(false); // Hide approvals section
      setStats({ total: 0, matched: 0, updated: 0, failed: 0 }); // Reset stats
    };

    reader.readAsText(file);
  };

  // Advanced text normalization function
  const normalizeText = (text) => {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .toLowerCase()
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common punctuation and special characters
      .replace(/[.,;:!?'"()[\]{}\-_]/g, ' ')
      // Remove extra spaces created by punctuation removal
      .replace(/\s+/g, ' ')
      .trim()
      // Remove common prefixes/suffixes that might vary
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+(ltd|limited|inc|incorporated|co|company|corp|corporation)$/i, '')
      // Remove size indicators that might vary
      .replace(/\s*(small|medium|large|xl|xxl|xs)\s*/gi, ' ')
      .replace(/\s*(s|m|l|xl|xxl|xs)\s*/gi, ' ')
      // Remove quantity indicators
      .replace(/\s*\d+\s*(oz|lb|kg|g|ml|l|pack|ct|count|piece|pieces|pcs)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Calculate similarity between two strings using Levenshtein distance
  const calculateSimilarity = (str1, str2) => {
    const norm1 = normalizeText(str1);
    const norm2 = normalizeText(str2);
    
    // If one string contains the other after normalization, high similarity
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.9;
    }
    
    // Calculate Levenshtein distance
    const matrix = [];
    const len1 = norm1.length;
    const len2 = norm2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (norm2.charAt(i - 1) === norm1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    
    // Convert distance to similarity score (0-1, where 1 is exact match)
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  };

  // Check if two strings have significant word overlap
  const calculateWordOverlap = (str1, str2) => {
    const words1 = normalizeText(str1).split(/\s+/).filter(w => w.length > 2); // Ignore very short words
    const words2 = normalizeText(str2).split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => 
      words2.some(w2 => w2.includes(word) || word.includes(w2))
    );
    
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  const findBestMatch = (csvRow, availableProducts) => {
    const searchName = csvRow.product_name?.trim();
    if (!searchName) return null;

    const candidates = availableProducts.map(product => {
      // Calculate scores against both English and Hebrew names
      const scoreEn = {
        similarity: calculateSimilarity(searchName, product.name),
        wordOverlap: calculateWordOverlap(searchName, product.name)
      };
      scoreEn.combinedScore = (scoreEn.similarity * 0.6) + (scoreEn.wordOverlap * 0.4);

      const scoreHe = {
        similarity: calculateSimilarity(searchName, product.name_hebrew),
        wordOverlap: calculateWordOverlap(searchName, product.name_hebrew)
      };
      scoreHe.combinedScore = (scoreHe.similarity * 0.6) + (scoreHe.wordOverlap * 0.4);

      // Choose the best score between the two
      const bestScore = scoreEn.combinedScore > scoreHe.combinedScore ? scoreEn : scoreHe;
      
      return {
        product,
        ...bestScore
      };
    });

    // Sort by combined score
    candidates.sort((a, b) => b.combinedScore - a.combinedScore);
    
    const bestCandidate = candidates[0];
    if (!bestCandidate || bestCandidate.combinedScore < 0.3) { // Use a minimum threshold
        return null; // No reasonable candidate
    }

    // Define confidence levels based on combined score
    if (bestCandidate.combinedScore >= 0.9) {
      return { product: bestCandidate.product, confidence: 'exact' };
    } else if (bestCandidate.combinedScore >= 0.7) {
      return { product: bestCandidate.product, confidence: 'high' };
    } else if (bestCandidate.combinedScore >= 0.5) {
      return { product: bestCandidate.product, confidence: 'medium' };
    } else { // bestCandidate.combinedScore >= 0.3
      return { product: bestCandidate.product, confidence: 'low' };
    }
  };

  const processMatching = async () => {
    if (csvData.length === 0) {
      alert('Please upload a CSV file first');
      return;
    }

    setProcessing(true);
    const results = [];
    const approvals = [];
    let autoMatchedCount = 0; // products automatically matched (exact/high)
    let autoUpdatedCount = 0; // products successfully updated automatically
    let failedCount = 0; // products with no match or update error

    try {
      let currentProducts = products;
      // If no products loaded yet, load all products for matching
      if (currentProducts.length === 0 || selectedVendor === 'all' || selectedVendor === 'auto') {
        // If selectedVendor is 'all' or 'auto', we need all products for potential matching across vendors
        // The `loadProducts` useCallback above deliberately skips loading all products to improve initial load time.
        // So, we fetch them here if we are going to match against all products.
        try {
          const allProducts = await Product.list();
          currentProducts = allProducts;
          // Note: We don't update `products` state here, to avoid re-rendering
          // It will be updated by the `loadProducts` useEffect when `selectedVendor` changes next time.
        } catch (error) {
          console.error("Failed to load all products for processing:", error);
          setProcessing(false);
          alert("Failed to load all products. Please try again.");
          return;
        }
      }

      for (const row of csvData) {
        let availableProductsForMatch = currentProducts;
        
        // If CSV has vendor information, filter products by vendor for this specific row
        if (row.vendor_id || row.vendor_name) {
          if (row.vendor_id) {
            availableProductsForMatch = currentProducts.filter(p => p.vendor_id === row.vendor_id);
          } else if (row.vendor_name) {
            const vendor = vendors.find(v => 
              normalizeText(v.name) === normalizeText(row.vendor_name)
            );
            if (vendor) {
              availableProductsForMatch = currentProducts.filter(p => p.vendor_id === vendor.id);
            } else {
              // If vendor name in CSV doesn't match any known vendor, then no products available for this row
              availableProductsForMatch = [];
            }
          }
        } else if (selectedVendor !== 'all' && selectedVendor !== 'auto') {
          // If no vendor info in CSV and a specific vendor is selected in UI, use that filter
          availableProductsForMatch = currentProducts.filter(p => p.vendor_id === selectedVendor);
        }
        // If selectedVendor is 'all' or 'auto' (and no vendor info in CSV), availableProductsForMatch remains `currentProducts` (all products)

        const matchResult = findBestMatch(row, availableProductsForMatch);
        
        if (matchResult) {
          // Auto-apply exact and high confidence matches
          if (matchResult.confidence === 'exact' || matchResult.confidence === 'high') {
            autoMatchedCount++;
            
            try {
              await Product.update(matchResult.product.id, {
                image_url: row.image_url
              });
              autoUpdatedCount++;
              
              results.push({
                csvRow: row,
                product: matchResult.product,
                status: 'success',
                confidence: matchResult.confidence,
                action: 'Updated product image'
              });
            } catch (updateError) {
              failedCount++;
              results.push({
                csvRow: row,
                product: matchResult.product,
                status: 'error',
                confidence: matchResult.confidence,
                error: updateError.message
              });
            }
          } else {
            // Add medium and low confidence matches to pending approvals
            approvals.push({
              id: `csv-${row._rowIndex}-prod-${matchResult.product.id}`, // Unique ID for approval
              csvRow: row,
              product: matchResult.product,
              confidence: matchResult.confidence,
              status: 'pending_approval'
            });
            
            results.push({
              csvRow: row,
              product: matchResult.product,
              status: 'pending_approval',
              confidence: matchResult.confidence,
              action: 'Requires user confirmation'
            });
            failedCount++; // Count as failed for initial summary, until approved
          }
        } else {
          failedCount++;
          results.push({
            csvRow: row,
            status: 'no-match',
            error: 'No matching product found'
          });
        }
      }

      setMatchResults(results);
      setPendingApprovals(approvals);
      setStats({
        total: csvData.length,
        matched: autoMatchedCount,
        updated: autoUpdatedCount,
        failed: failedCount
      });

      // Show approval interface if there are pending approvals
      if (approvals.length > 0) {
        setShowingApprovals(true);
      }

    } catch (error) {
      console.error('Error processing matches:', error);
      alert('An error occurred while processing matches');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveMatch = async (approvalId) => {
    const approval = pendingApprovals.find(a => a.id === approvalId);
    if (!approval) return;

    try {
      await Product.update(approval.product.id, {
        image_url: approval.csvRow.image_url
      });

      // Update the results: Change status from 'pending_approval' to 'success'
      setMatchResults(prev => prev.map(result => 
        result.csvRow._rowIndex === approval.csvRow._rowIndex && 
        result.product?.id === approval.product.id
          ? { ...result, status: 'success', action: 'Updated product image (user approved)' }
          : result
      ));

      // Remove from pending approvals
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));

      // Update stats
      setStats(prev => ({
        ...prev,
        updated: prev.updated + 1,
        failed: prev.failed > 0 ? prev.failed - 1 : 0 // Decrease failed count as it's now updated
      }));

    } catch (error) {
      console.error('Error updating product:', error);
      // If update fails, update the status in matchResults to error
      setMatchResults(prev => prev.map(result => 
        result.csvRow._rowIndex === approval.csvRow._rowIndex && 
        result.product?.id === approval.product.id
          ? { ...result, status: 'error', action: 'Failed to update after approval', error: error.message }
          : result
      ));
      // Remove from pending approvals, as user has attempted action
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    }
  };

  const handleRejectMatch = (approvalId) => {
    const approval = pendingApprovals.find(a => a.id === approvalId);
    if (!approval) return;

    // Update the results: Change status from 'pending_approval' to 'rejected'
    setMatchResults(prev => prev.map(result => 
      result.csvRow._rowIndex === approval.csvRow._rowIndex && 
      result.product?.id === approval.product.id
        ? { ...result, status: 'rejected', action: 'Match rejected by user', error: 'User rejected the match' }
        : result
    ));

    // Remove from pending approvals
    setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    // No change to updated/failed stats. It was already contributing to 'failed' and remains so.
  };

  const handleApproveAll = async () => {
    if (!window.confirm(`Are you sure you want to approve all ${pendingApprovals.length} pending matches? This action cannot be undone.`)) {
      return;
    }

    // Process a copy of pendingApprovals, as the state will change during iteration
    const approvalsToProcess = [...pendingApprovals]; 
    for (const approval of approvalsToProcess) {
      // Re-fetch the approval from the state to ensure it still exists and is correct,
      // though for this sequential processing, the copied `approval` object should be fine.
      // Call `handleApproveMatch` to ensure all side effects (state updates) are managed.
      await handleApproveMatch(approval.id);
    }
  };

  const handleRejectAll = () => {
    if (!window.confirm(`Are you sure you want to reject all ${pendingApprovals.length} pending matches? This action cannot be undone.`)) {
      return;
    }

    // Process a copy of pendingApprovals, as the state will change during iteration
    const approvalsToProcess = [...pendingApprovals]; 
    approvalsToProcess.forEach(approval => {
      // Call `handleRejectMatch` to ensure all side effects (state updates) are managed.
      handleRejectMatch(approval.id);
    });
  };

  const downloadResults = () => {
    if (matchResults.length === 0) return;

    const headers = ['CSV_Row', 'Product_Name_CSV', 'Image_URL_CSV', 'Matched_Product_Name', 'Vendor', 'Status', 'Confidence', 'Action', 'Error'];
    const rows = matchResults.map(result => [
      result.csvRow._rowIndex,
      result.csvRow.product_name || '',
      result.csvRow.image_url || '',
      result.product?.name || 'No match',
      result.product ? (vendors.find(v => v.id === result.product.vendor_id)?.name || 'Unknown') : '',
      result.status,
      result.confidence || '',
      result.action || '',
      result.error || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image_matching_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'no-match': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'exact': return 'bg-green-100 text-green-800 border-green-200';
      case 'high': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Matcher</h1>
          <p className="text-gray-600">
            Upload a CSV file with product names and image URLs to automatically match and assign images to products using advanced fuzzy matching.
          </p>
        </div>

        <div className="grid gap-6">
          {/* CSV Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload CSV File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-upload">Select CSV file:</Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="mt-2"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Expected columns: product_name, image_url. Optional: vendor_id, vendor_name
                  </p>
                </div>

                {csvData.length > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">
                      ✓ CSV loaded: {csvData.length} rows found
                    </p>
                    {selectedVendor === 'auto' && (
                      <p className="text-sm text-green-700 mt-1">
                        ✓ Vendor information detected in CSV - will use automatic vendor matching
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vendor Filter (only show if CSV doesn't have vendor info) */}
          {csvData.length > 0 && selectedVendor !== 'auto' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  Vendor Filter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vendor-filter">Filter products by vendor:</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select a vendor..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendors.map(vendor => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 mt-1">
                      Only products from the selected vendor will be considered for matching
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Process Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={processMatching}
                  disabled={csvData.length === 0 || processing || (selectedVendor === 'all' && csvData.length > 0 && !csvData.some(row => row.vendor_id || row.vendor_name))}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing {csvData.length} rows...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find Matches and Update Products
                    </>
                  )}
                </Button>

                {selectedVendor === 'all' && csvData.length > 0 && !csvData.some(row => row.vendor_id || row.vendor_name) && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      To ensure accurate matching, please select a specific vendor from the filter above, or upload a CSV with 'vendor_id' or 'vendor_name' columns.
                    </p>
                  </div>
                )}
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <Search className="w-4 h-4 inline mr-1" />
                    Using advanced fuzzy matching to find products with similar names, even with variations in spelling, punctuation, and formatting.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          {showingApprovals && pendingApprovals.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    Pending Match Approvals ({pendingApprovals.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={handleRejectAll} variant="outline" size="sm">
                      <X className="w-4 h-4 mr-2" />
                      Reject All
                    </Button>
                    <Button onClick={handleApproveAll} size="sm" className="bg-green-600 hover:bg-green-700">
                      <Check className="w-4 h-4 mr-2" />
                      Approve All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {pendingApprovals.map((approval) => (
                    <div key={approval.id} className="border rounded-lg p-4 bg-yellow-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm text-gray-500">Row {approval.csvRow._rowIndex}:</span>
                            <Badge className={`${getConfidenceColor(approval.confidence)} text-xs`}>
                              {approval.confidence} match
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div>
                              <p className="text-gray-600">CSV Product Name:</p>
                              <p className="font-medium text-gray-900">{approval.csvRow.product_name}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Suggested Match:</p>
                              <p className="font-medium text-blue-900">{approval.product.name}</p>
                              {approval.product.name_hebrew && (
                                <p className="font-medium text-blue-800 text-xs">({approval.product.name_hebrew})</p>
                              )}
                              <p className="text-xs text-gray-500">
                                Vendor: {vendors.find(v => v.id === approval.product.vendor_id)?.name || 'Unknown'}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button 
                              onClick={() => handleApproveMatch(approval.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              onClick={() => handleRejectMatch(approval.id)}
                              variant="outline"
                              size="sm"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {approval.csvRow.image_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">New Image</p>
                              <img 
                                src={approval.csvRow.image_url} 
                                alt="New Product" 
                                className="w-16 h-16 object-cover rounded-lg"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                          {approval.product.image_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Current Image</p>
                              <img 
                                src={approval.product.image_url} 
                                alt="Current Product" 
                                className="w-16 h-16 object-cover rounded-lg"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {stats.total > 0 && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Matching Results
                  </CardTitle>
                  <Button onClick={downloadResults} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Results
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                      <div className="text-sm text-blue-700">Total Rows</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
                      <div className="text-sm text-green-700">Auto Matched</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-yellow-600">{pendingApprovals.length}</div>
                      <div className="text-sm text-yellow-700">Pending</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.updated}</div>
                      <div className="text-sm text-purple-700">Updated</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                      <div className="text-sm text-red-700">Failed</div>
                    </div>
                  </div>

                  {/* Detailed Results */}
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {matchResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm text-gray-500">Row {result.csvRow._rowIndex}:</span>
                              <span className="font-medium">{result.csvRow.product_name}</span>
                              <Badge className={`${getStatusColor(result.status)} text-xs`}>
                                {result.status === 'pending_approval' ? 'pending approval' : result.status}
                              </Badge>
                              {result.confidence && (
                                <Badge className={`${getConfidenceColor(result.confidence)} text-xs`}>
                                  {result.confidence} match
                                </Badge>
                              )}
                            </div>
                            
                            {result.product && (
                              <div className="text-sm text-gray-600">
                                <p>→ {result.status === 'pending_approval' ? 'Suggested match' : 'Matched to'}: <span className="font-medium">{result.product.name}</span></p>
                                {result.product.name_hebrew && (
                                  <p className="font-medium text-blue-800 text-xs">({result.product.name_hebrew})</p>
                                )}
                                <p>→ Vendor: {vendors.find(v => v.id === result.product.vendor_id)?.name || 'Unknown'}</p>
                              </div>
                            )}
                            
                            {result.error && (
                              <p className="text-sm text-red-600 mt-1">Error: {result.error}</p>
                            )}
                            
                            {result.action && (
                              <p className="text-xs text-gray-500 mt-1">Action: {result.action}</p>
                            )}
                          </div>
                          
                          {result.csvRow.image_url && (
                            <img 
                              src={result.csvRow.image_url} 
                              alt="Product" 
                              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
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
                  <p><strong>Prepare your CSV:</strong> Include columns for 'product_name' and 'image_url'. Optionally include 'vendor_id' or 'vendor_name' for automatic vendor matching.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <p><strong>Upload CSV:</strong> Select your CSV file. The system will automatically detect vendor information and use advanced fuzzy matching for product names.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <p><strong>Select Vendor (if needed):</strong> If your CSV doesn't include vendor information, choose a specific vendor to match against.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <p><strong>Process:</strong> Click "Find Matches" to automatically match product names. Exact and high confidence matches are applied automatically.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                  <p><strong>Review & Approve:</strong> Medium and low confidence matches require your approval. Review each suggested match and approve or reject as needed.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">6</span>
                  <p><strong>Download Results:</strong> Get a detailed report of all matches, approvals, and rejections.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
