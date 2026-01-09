import React from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Clock } from "lucide-react";

export default function DefaultHome() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-center p-4">
      <div className="max-w-md">
        <Clock className="w-24 h-24 text-green-500 mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
          {t('home.comingSoonTitle', 'Coming Soon!')}
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          {t('home.comingSoonMessage', 'We are working hard to bring you something amazing. Stay tuned!')}
        </p>
      </div>
    </div>
  );
}