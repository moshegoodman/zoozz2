import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, User, Camera, CheckCircle2, Navigation, Loader2, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function DeliveryCard({ order, onUpdate, isHebrew }) {
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef(null);

  const address = [order.street, order.building_number, order.neighborhood].filter(Boolean).join(", ");
  const recipient = order.household_name || order.user_email;
  const isDelivered = order.status === "delivered";

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Order.update(order.id, { delivery_proof_url: file_url });
      onUpdate?.({ ...order, delivery_proof_url: file_url });
    } catch (err) {
      console.error("Upload failed", err);
      alert(isHebrew ? "העלאת התמונה נכשלה" : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order.delivery_proof_url) {
      if (!window.confirm(isHebrew ? "לא הועלתה תמונה. להמשיך בכל זאת?" : "No photo uploaded. Confirm anyway?")) return;
    }
    setConfirming(true);
    try {
      const updates = {
        status: "delivered",
        delivered_at: new Date().toISOString(),
      };
      await base44.entities.Order.update(order.id, updates);
      onUpdate?.({ ...order, ...updates });
    } catch (err) {
      console.error("Confirm failed", err);
      alert(isHebrew ? "אישור המסירה נכשל" : "Failed to confirm delivery");
    } finally {
      setConfirming(false);
    }
  };

  const openNavigation = () => {
    const q = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, "_blank");
  };

  return (
    <Card className={`${isDelivered ? "bg-green-50 border-green-200" : "bg-white"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {order.delivery_sequence != null && !isDelivered && (
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {order.delivery_sequence}
                </span>
              )}
              <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="font-semibold text-gray-900 truncate">{recipient}</span>
              {isDelivered && <Badge className="bg-green-600 text-white">{isHebrew ? "נמסר" : "Delivered"}</Badge>}
            </div>
            <p className="text-xs text-gray-500">#{order.order_number?.slice(-8)} · {order.delivery_time || "—"}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        <button onClick={openNavigation} className="w-full flex items-start gap-2 text-left bg-blue-50 hover:bg-blue-100 rounded-lg p-2.5 transition-colors">
          <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 truncate">{address}</p>
            {order.entrance_code && <p className="text-xs text-blue-700">{isHebrew ? "קוד כניסה" : "Entry"}: {order.entrance_code}</p>}
          </div>
          <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0" />
        </button>

        {order.delivery_notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
            <p className="text-xs font-semibold text-yellow-800 mb-0.5">
              {isHebrew ? "הוראות מסירה" : "Delivery Instructions"}
            </p>
            <p className="text-sm text-yellow-900 whitespace-pre-wrap">{order.delivery_notes}</p>
          </div>
        )}

        {expanded && (
          <div className="space-y-2 text-sm border-t pt-2">
            {(order.household_lead_phone || order.phone) && (
              <a href={`tel:${order.household_lead_phone || order.phone}`} className="flex items-center gap-2 text-blue-600">
                <Phone className="w-4 h-4" />
                {order.household_lead_phone || order.phone}
              </a>
            )}
            {order.household_lead_name && (
              <p className="text-gray-700"><span className="text-gray-500">{isHebrew ? "איש קשר" : "Contact"}:</span> {order.household_lead_name}</p>
            )}
          </div>
        )}

        {!isDelivered && (
          <>
            {order.delivery_proof_url ? (
              <div className="relative">
                <img src={order.delivery_proof_url} alt="proof" className="w-full h-32 object-cover rounded-lg" />
                <button onClick={() => fileRef.current?.click()} className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {isHebrew ? "החלף" : "Replace"}
                </button>
              </div>
            ) : (
              <Button onClick={() => fileRef.current?.click()} variant="outline" disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                {isHebrew ? "צלם תמונת מסירה" : "Take Delivery Photo"}
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />

            <Button onClick={handleConfirmDelivery} disabled={confirming} className="w-full bg-green-600 hover:bg-green-700">
              {confirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {isHebrew ? "אשר מסירה" : "Confirm Delivery"}
            </Button>
          </>
        )}

        {isDelivered && order.delivery_proof_url && (
          <a href={order.delivery_proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-700">
            <ImageIcon className="w-4 h-4" />
            {isHebrew ? "צפה בתמונת מסירה" : "View delivery photo"}
          </a>
        )}
      </CardContent>
    </Card>
  );
}