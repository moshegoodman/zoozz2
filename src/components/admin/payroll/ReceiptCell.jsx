import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload } from "lucide-react";

/**
 * Inline receipt cell for the AP table.
 * - If a receipt exists: shows "View" link + "Change" trigger.
 * - If no receipt: shows "Upload" trigger.
 * Calls onUploaded(file_url) after a successful upload.
 */
export default function ReceiptCell({ receiptUrl, onUploaded }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await onUploaded(file_url);
    } catch (err) {
      console.error(err);
      alert("Receipt upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      {isUploading ? (
        <span className="text-gray-500 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
        </span>
      ) : receiptUrl ? (
        <>
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            View
          </a>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-green-600"
            title="Change receipt"
          >
            Change
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 text-gray-400 hover:text-green-600"
          title="Upload receipt"
        >
          <Upload className="w-3 h-3" /> Upload
        </button>
      )}
    </div>
  );
}