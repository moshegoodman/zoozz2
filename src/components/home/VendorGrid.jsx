import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Crown } from "lucide-react";
import { useCart } from "../cart/CartContext";
import { useLanguage } from "../components/i18n/LanguageContext";

export default function VendorGrid({ vendors, isLoading, userType }) {
  const { language } = useLanguage();
  const { getVendorCartCount } = useCart();
  

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 sm:grid-col-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {Array(12).fill(0).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <CardContent className="p-2 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
      {vendors.map((vendor) => {
        const vendorCartCount = getVendorCartCount(vendor.id);
        return (
          <Link key={vendor.id} to={createPageUrl(`Vendor?id=${vendor.id}`)}>
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white overflow-hidden">
              <div className="relative">
                <img
                  src={vendor.banner_url || vendor.image_url || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=400&fit=crop"}
                  alt={language === 'Hebrew' ? vendor.name_hebrew : vendor.name}
                  className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-1 right-1 flex flex-col gap-1">
                  {vendor.kcs_exclusive && (
                    <Badge className="bg-purple-600 text-white border-purple-700 shadow-lg text-xs px-1 py-0">
                      <Crown className="w-2 h-2 mr-0.5" /> KCS
                    </Badge>
                  )}
                  {vendorCartCount > 0 && (
                    <Link to={createPageUrl("Cart")} onClick={(e) => e.stopPropagation()}>
                       <Badge className="bg-green-600 text-white border-green-700 shadow-lg hover:bg-green-700 transition-colors cursor-pointer text-xs px-1 py-0">
                          <ShoppingCart className="w-2 h-2 mr-0.5" /> {vendorCartCount}
                       </Badge>
                    </Link>
                  )}
                </div>
              </div>
              
              <CardContent className="p-2">
                <div>
               {language === 'Hebrew' ? (vendor.name_hebrew && (
                    <p className="text-xs text-gray-600 line-clamp-1 mt-0.5" style={{ direction: 'rtl' }}>
                      {vendor.name_hebrew}
                    </p>
                  )) :  <h3 className="font-semibold text-xs text-gray-900 line-clamp-2 leading-tight">{vendor.name}</h3>
                 }
                   
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  );
}