import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Zap } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { processImageZip } from '@/functions/processImageZip';

export default function ProcessImageZip() {
  const [zipFile, setZipFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [feedback, setFeedback] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/zip') {
      setZipFile(file);
      setUploadedFileUrl(null);
      setFeedback('');
    } else {
      setZipFile(null);
      alert('Please select a valid .zip file.');
    }
  };

  const handleUpload = async () => {
    if (!zipFile) {
      alert('Please select a .zip file first.');
      return;
    }

    setIsUploading(true);
    setFeedback('Uploading ZIP file... This may take a moment for large files.');
    try {
      const result = await UploadFile({ file: zipFile });
      setUploadedFileUrl(result.file_url);
      setFeedback(`Upload complete! ZIP file is ready to be processed.`);
    } catch (error) {
      console.error('Error uploading ZIP file:', error);
      setFeedback(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!uploadedFileUrl) {
      alert('Please upload a ZIP file first.');
      return;
    }

    setIsProcessing(true);
    setFeedback('Processing images on the server. This could take several minutes for thousands of images. You can safely navigate away and check back later, but leaving the page open will allow for automatic download when complete.');
    try {
      const response = await processImageZip({ zip_file_url: uploadedFileUrl });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'image_mapping_output.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedback('Processing complete! Your CSV file has been downloaded.');
    } catch (error) {
      console.error('Error processing ZIP file:', error);
      setFeedback(`Processing failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scalable Image Processor</h1>
          <p className="text-gray-600">
            Process tens of thousands of product images efficiently by uploading a single ZIP file.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="md:col-span-1 p-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">1</div>
            <h3 className="font-semibold text-lg mb-2">Prepare Your Files</h3>
            <p className="text-sm text-gray-600">Name each image file with the corresponding product <strong className="text-gray-800">SKU</strong> (e.g., `ABC-123.jpg`). Place all images into a single `.zip` file.</p>
          </div>
          <div className="md:col-span-1 p-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">2</div>
            <h3 className="font-semibold text-lg mb-2">Upload the ZIP File</h3>
            <p className="text-sm text-gray-600">Upload the entire `.zip` file. This is a single, reliable upload, no matter how many images are inside.</p>
          </div>
          <div className="md:col-span-1 p-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">3</div>
            <h3 className="font-semibold text-lg mb-2">Process & Download</h3>
            <p className="text-sm text-gray-600">Our server will process all images and generate a CSV mapping SKUs to image URLs, ready for the Image Matcher tool.</p>
          </div>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Image Processing Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="zip-upload">Step 1: Upload Your ZIP File</Label>
              <div className="flex gap-2">
                <Input
                  id="zip-upload"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={handleFileChange}
                  className="flex-grow"
                  disabled={isUploading || isProcessing}
                />
                <Button onClick={handleUpload} disabled={!zipFile || isUploading || isProcessing}>
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>

            {uploadedFileUrl && (
              <div className="space-y-2">
                <Label>Step 2: Process the Uploaded File</Label>
                <Button onClick={handleProcess} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700">
                   {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing on Server...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Process Images and Generate CSV
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {feedback && (
              <div className="p-4 bg-gray-100 rounded-lg text-sm text-gray-700">
                <p>{feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}