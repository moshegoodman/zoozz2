import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Camera, Loader2, Type, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function BarcodeScanner({ isOpen, onClose, onScanSuccess }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const scanIntervalRef = useRef(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Check for BarcodeDetector support
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      setDetectorSupported(true);
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setIsInitializing(true);
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        
        // Start barcode detection if supported
        if (detectorSupported && detectorRef.current) {
          startBarcodeDetection();
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      handleCameraError(err);
    } finally {
      setIsInitializing(false);
    }
  };

  const startBarcodeDetection = () => {
    if (!detectorSupported || !videoRef.current || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    const detectBarcodes = async () => {
      if (!video.videoWidth || !video.videoHeight) return;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        // Detect barcodes from the canvas
        const barcodes = await detectorRef.current.detect(canvas);
        
        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          console.log('Barcode detected:', barcode.rawValue);
          onScanSuccess(barcode.rawValue);
          onClose();
          return;
        }
      } catch (error) {
        console.error('Barcode detection error:', error);
      }
    };

    // Start detection loop
    scanIntervalRef.current = setInterval(detectBarcodes, 200);
  };

  const stopCamera = () => {
    // Stop scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const handleCameraError = (err) => {
    let errorMessage = t('scanner.cameraError', 'Could not access camera. Please ensure camera permissions are granted.');
    
    if (err.name === 'NotAllowedError') {
      errorMessage = t('scanner.permissionDenied', 'Camera permission was denied. Please enable it in your browser settings.');
    } else if (err.name === 'NotFoundError') {
      errorMessage = t('scanner.noCameraFound', 'No camera was found on this device.');
    } else if (err.name === 'NotReadableError') {
      errorMessage = t('scanner.cameraInUse', 'Camera is already in use by another application.');
    }
    
    setError(errorMessage);
    setIsScanning(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScanSuccess(manualBarcode.trim());
      setManualBarcode('');
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full mx-auto p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {t('scanner.title', 'Scan Barcode')}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative">
          {error ? (
            <div className="p-6 text-center">
              <div className="mb-4 text-red-600">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{error}</p>
              </div>
              <Button onClick={() => setShowManualInput(true)} className="w-full">
                <Type className="w-4 h-4 mr-2" />
                {t('scanner.manualEntry', 'Enter Manually')}
              </Button>
            </div>
          ) : showManualInput ? (
            <div className="p-6">
              <form onSubmit={handleManualSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    {t('scanner.enterBarcode', 'Enter Barcode')}
                  </label>
                  <Input
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="123456789012"
                    className="w-full"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowManualInput(false)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button type="submit" disabled={!manualBarcode.trim()}>
                    {t('scanner.confirm', 'Confirm')}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="relative">
              {/* Video Element */}
              <video
                ref={videoRef}
                className="w-full h-64 object-cover bg-black"
                playsInline
                muted
              />
              
              {/* Hidden canvas for barcode detection */}
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  {/* Scanning frame */}
                  <div className="w-64 h-40 border-2 border-white rounded-lg relative">
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                    
                    {/* Scanning line animation */}
                    {isScanning && (
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <div className="h-0.5 bg-green-400 opacity-75 animate-pulse w-full absolute top-1/2 transform -translate-y-1/2"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Status text */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 text-center">
                {isInitializing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{t('scanner.initializing', 'Initializing camera...')}</span>
                  </div>
                ) : isScanning ? (
                  <div>
                    <p className="text-sm font-medium">
                      {detectorSupported 
                        ? t('scanner.scanning', 'Scanning for barcodes...')
                        : t('scanner.cameraActive', 'Camera active - barcode detection not supported')
                      }
                    </p>
                    <p className="text-xs mt-1 opacity-75">
                      {t('scanner.instruction', 'Center the barcode within the frame')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm">{t('scanner.startingCamera', 'Starting camera...')}</p>
                )}
              </div>
              
              {/* Manual input button */}
              <Button
                onClick={() => setShowManualInput(true)}
                variant="secondary"
                size="sm"
                className="absolute top-4 right-4 bg-black bg-opacity-50 text-white border-white"
              >
                <Type className="w-4 h-4 mr-1" />
                {t('scanner.manual', 'Manual')}
              </Button>
              
              {!detectorSupported && (
                <div className="absolute top-4 left-4 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
                  {t('scanner.detectionNotSupported', 'Auto-detection not supported')}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}