import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Product } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, CheckCircle, ImageIcon, RefreshCw } from "lucide-react";

function generateSKU(name, vendorId) {
  const prefix = (name || "ITEM").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  const suffix = Date.now().toString().slice(-6);
  const vendorTag = (vendorId || "V").slice(-3).toUpperCase();
  return `${prefix}-${vendorTag}-${suffix}`;
}

export default function AddProductFromImageModal({ open, onClose, vendorId, vendorSubcategories, onProductCreated }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [originalFileUrl, setOriginalFileUrl] = useState(null);
  const fileInputRef = useRef();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setForm(null);
    setSaved(false);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    try {
      // Upload image first
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      setOriginalFileUrl(file_url);

      // Run LLM analysis and image generation in parallel
      const [result, generatedImage] = await Promise.all([
        base44.integrations.Core.InvokeLLM({
          prompt: `You are a product catalog assistant. Analyze this product image and extract product information.
Return a JSON object with these fields:
- name: product name in English
- name_hebrew: product name in Hebrew (translate accurately)
- description: short English description (1-2 sentences)
- description_hebrew: Hebrew description
- brand: brand name if visible, otherwise empty string
- brand_hebrew: brand name in Hebrew if applicable
- subcategory: best fitting subcategory (e.g. "Dairy", "Produce", "Bakery", "Snacks", "Beverages", "Cleaning", "Personal Care", etc.)
- unit: unit of measurement, one of: "each", "kg", "lb", "pack", "liter", "g", "ml"
- quantity_in_unit: quantity description visible on package (e.g. "500g", "1L", "12 pieces") or empty string
- price_base: estimated retail price in ILS (Israeli Shekel) as a number, make a reasonable estimate based on the product type
- kashrut: kashrut certification if visible, otherwise empty string
- barcode: EAN or UPC barcode number if visible on the package, otherwise empty string

Be accurate and concise.`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              name_hebrew: { type: "string" },
              description: { type: "string" },
              description_hebrew: { type: "string" },
              brand: { type: "string" },
              brand_hebrew: { type: "string" },
              subcategory: { type: "string" },
              unit: { type: "string" },
              quantity_in_unit: { type: "string" },
              price_base: { type: "number" },
              kashrut: { type: "string" },
              barcode: { type: "string" },
            }
          }
        }),
        base44.integrations.Core.GenerateImage({
          prompt: `Remove the background and replace it with a clean plain white background. Keep the product exactly as it is — do not alter, replace, or modify the product itself in any way. Just clean up around it.`,
          existing_image_urls: [file_url],
        }).catch(imgErr => { console.warn("Image cleanup failed, using original:", imgErr); return null; }),
      ]);

      const cleanImageUrl = generatedImage?.url || file_url;

      const sku = generateSKU(result.name, vendorId);
      setForm({
        ...result,
        sku,
        price_base: result.price_base || 0,
        price_customer_app: result.price_base || 0,
        price_customer_kcs: result.price_base || 0,
        image_url: cleanImageUrl,
        vendor_id: vendorId,
        stock_quantity: 100,
        is_draft: false,
      });
    } catch (e) {
      console.error(e);
      alert("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form) return;
    setIsSaving(true);
    try {
      const created = await Product.create(form);
      setSaved(true);
      if (onProductCreated) onProductCreated(created);
      setTimeout(() => {
        setSaved(false);
        setForm(null);
        setImageFile(null);
        setImagePreview(null);
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
      alert("Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!originalFileUrl || !form?.name) return;
    setIsRegeneratingImage(true);
    try {
      const generated = await base44.integrations.Core.GenerateImage({
        prompt: `Clean product photo of "${form.name}" on a plain white background, professional retail product photography, no shadows, centered, high quality`,
        existing_image_urls: [originalFileUrl],
      });
      if (generated?.url) handleFieldChange("image_url", generated.url);
    } catch (e) {
      console.error("Image regeneration failed:", e);
      alert("Failed to regenerate image. Please try again.");
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleClose = () => {
    setForm(null);
    setImageFile(null);
    setImagePreview(null);
    setOriginalFileUrl(null);
    setSaved(false);
    onClose();
  };

  const fields = [
    { key: "name", label: "Name (English)", type: "text" },
    { key: "name_hebrew", label: "Name (Hebrew)", type: "text" },
    { key: "sku", label: "SKU", type: "text" },
    { key: "brand", label: "Brand", type: "text" },
    { key: "subcategory", label: "Subcategory", type: "subcategory" },
    { key: "unit", label: "Unit", type: "text" },
    { key: "quantity_in_unit", label: "Qty in Unit", type: "text" },
    { key: "price_base", label: "Base Price (₪)", type: "number" },
    { key: "price_customer_app", label: "App Price (₪)", type: "number" },
    { key: "price_customer_kcs", label: "KCS Price (₪)", type: "number" },
    { key: "kashrut", label: "Kashrut", type: "text" },
    { key: "barcode", label: "Barcode", type: "text" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Add New Product from Image
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
          >
            {imagePreview ? (
              <div className="flex items-center gap-4">
                <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl shadow" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700">{imageFile?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">Click to change image</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <ImageIcon className="w-10 h-10" />
                <p className="text-sm font-medium">Click to upload product image</p>
                <p className="text-xs">JPG, PNG, WEBP</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          {imageFile && !form && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isAnalyzing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing image with AI…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Analyze with AI</>
              )}
            </Button>
          )}

          {/* Editable form */}
          {form && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                <Sparkles className="w-4 h-4" />
                AI filled in the details — review and edit before saving.
              </div>

              {/* Clean image preview with redo option */}
              {form.image_url && (
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                  <img src={form.image_url} alt="Product" className="w-20 h-20 object-cover rounded-lg border shadow-sm" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-2">AI-generated clean image</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateImage}
                      disabled={isRegeneratingImage}
                      className="text-purple-600 border-purple-300 hover:bg-purple-50"
                    >
                      {isRegeneratingImage
                        ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Regenerating…</>
                        : <><RefreshCw className="w-3 h-3 mr-1" /> Redo Image</>
                      }
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {fields.map(f => (
                  <div key={f.key} className={f.key === "name" || f.key === "name_hebrew" ? "col-span-2" : ""}>
                    <Label className="text-xs text-gray-500 mb-1">{f.label}</Label>
                    {f.type === "subcategory" ? (
                      <Select value={form[f.key] ?? ""} onValueChange={val => handleFieldChange(f.key, val)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {(vendorSubcategories || []).map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                          {/* Always allow the AI-suggested value even if not in list */}
                          {form[f.key] && !(vendorSubcategories || []).includes(form[f.key]) && (
                            <SelectItem value={form[f.key]}>{form[f.key]} (AI suggested)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type}
                        value={form[f.key] ?? ""}
                        onChange={e => handleFieldChange(f.key, f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || saved}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {saved ? (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
                  ) : isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                  ) : (
                    "Save to Store"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}