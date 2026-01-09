import React from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../i18n/LanguageContext";
import { useCart } from "./CartContext";

export default function EmptyCart() {
  const { t } = useLanguage();
  const { user } = useCart();

  const isVendorShopping = user && (user.user_type === 'vendor' || user.user_type === 'picker') && sessionStorage.getItem('shoppingForHousehold');
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.emptyTitle')}</h2>
        <p className="text-gray-600 mb-8">
          {t('cart.emptyDescription')}
        </p>
        <Link to={isVendorShopping ? createPageUrl(`Vendor?id=${user.vendor_id}`) : createPageUrl("Products")}>
          <Button size="lg" className="bg-green-600 hover:bg-green-700">
            {isVendorShopping ? (
              <>
                <Store className="w-5 h-5 mr-2" />
                {t('cart.backToStore')}
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 mr-2" />
                {t('cart.startShopping')}
              </>
            )}
          </Button>
        </Link>
      </div>
    </div>
  );
}