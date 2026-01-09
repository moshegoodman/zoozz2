import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";

export default function ProductsPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link 
            to={createPageUrl("Home")} 
            className="flex items-center gap-2 text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors rounded-lg px-3 py-2 -ml-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{t('navigation.home', 'Home')}</span>
          </Link>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('products.blocked.title', 'Products Page Unavailable')}
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              {t('products.blocked.description', 'This page is currently not available. Please browse products through individual stores from the home page.')}
            </p>
            <Link to={createPageUrl("Home")}>
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                {t('products.blocked.backToHome', 'Back to Home')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}