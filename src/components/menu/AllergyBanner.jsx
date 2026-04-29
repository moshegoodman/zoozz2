import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AllergyBanner({ text }) {
  if (!text?.trim()) return null;
  return (
    <div className="w-full bg-red-600 text-white px-4 py-2 flex items-center gap-2 rounded-lg mb-4 shadow">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <span className="font-bold text-sm uppercase tracking-wide">Allergy Alert:</span>
      <span className="text-sm">{text}</span>
    </div>
  );
}