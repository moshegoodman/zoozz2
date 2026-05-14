import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { useLocationTracking } from "@/hooks/useLocationTracking";

const STORAGE_KEY = "zoozz_driver_tracking_consent";

/**
 * Driver-facing location tracking control. Off by default.
 * Stores user consent in localStorage. Shown only on the driver's delivery dashboard
 * while they have active deliveries.
 *
 * App Store / Play Store compliance:
 *  - Explicit user opt-in (toggle off by default)
 *  - Clear purpose disclosure
 *  - Easy to disable
 *  - Tracking stops when toggle is off
 */
export default function DriverLocationTracker({ isHebrew = false, hasActiveDeliveries = false }) {
  const [consent, setConsent] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  // Only actually track when user has consented AND has active deliveries
  const shouldTrack = consent && hasActiveDeliveries;

  const { isTracking, lastPosition, error, isOnline } = useLocationTracking({ enabled: shouldTrack });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(consent)); } catch { /* ignore */ }
  }, [consent]);

  return (
    <Card className="border-blue-100 bg-blue-50/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isTracking ? "text-blue-600 animate-pulse" : "text-gray-400"}`} />
            <div className="min-w-0">
              <Label htmlFor="track-toggle" className="font-semibold text-sm cursor-pointer">
                {isHebrew ? "שתף מיקום במהלך משלוחים" : "Share location during deliveries"}
              </Label>
              <p className="text-xs text-gray-600 mt-0.5">
                {isHebrew
                  ? "עוזר למוקד לעקוב אחר התקדמות המסלול. רק כאשר יש לך משלוחים פעילים."
                  : "Helps dispatch track route progress. Only while you have active deliveries."}
              </p>
              {isTracking && (
                <div className="flex items-center gap-2 mt-1.5 text-xs">
                  {isOnline ? (
                    <span className="flex items-center gap-1 text-green-700"><Wifi className="w-3 h-3" />{isHebrew ? "מעקב פעיל" : "Tracking active"}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700"><WifiOff className="w-3 h-3" />{isHebrew ? "לא מקוון – נשמר באופן מקומי" : "Offline – queued locally"}</span>
                  )}
                  {lastPosition && (
                    <span className="text-gray-500">±{Math.round(lastPosition.accuracy)}m</span>
                  )}
                </div>
              )}
              {error && (
                <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle className="w-3 h-3" />{error}
                </div>
              )}
            </div>
          </div>
          <Switch
            id="track-toggle"
            checked={consent}
            onCheckedChange={setConsent}
          />
        </div>
      </CardContent>
    </Card>
  );
}