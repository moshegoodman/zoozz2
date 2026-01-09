
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "./ProductCard";
import ProductListItem from "./ProductListItem";

export default function ProductGrid({
  products,
  isLoading,
  viewMode = "grid",
  userType,
  selectedHousehold,
  showVendor = true, // This prop is used by ProductListItem
  onAddToCart,       // New prop for ProductCard
  cartItemsMap,      // New prop for ProductCard to determine cart state
  onUpdateQuantity,  // New prop for ProductCard
  showVendorName,    // New prop for ProductCard, likely replaces or complements showVendor
  language           // New prop for ProductCard
}) {
  if (isLoading) {
    return (
      <div className={viewMode === "grid"
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" // Skeleton grid layout remains unchanged from outline
        : "space-y-4"
      }>
        {Array(12).fill(0).map((_, i) => (
          <div key={i} className={viewMode === "grid" ? "space-y-3" : "flex gap-4 p-2"}>
            <Skeleton className={viewMode === "grid" ? "aspect-square rounded-lg" : "w-24 h-24 rounded-lg"} />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">No products found</div>
        <p className="text-gray-400">Try adjusting your search or filters</p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        {products.map((product) => (
          <ProductListItem
            key={product.id}
            product={product}
            userType={userType}
            selectedHousehold={selectedHousehold}
            showVendor={showVendor} // Preserving existing prop for ProductListItem
          />
        ))}
      </div>
    );
  }

  return (
    // Updated grid classes for smaller cards as per the outline
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          // New props for cart functionality
          onAddToCart={onAddToCart}
          isInCart={cartItemsMap?.has(product.id) || false} // Added nullish coalescing for safety
          cartQuantity={cartItemsMap?.get(product.id)?.quantity || 0} // Added nullish coalescing for safety
          onUpdateQuantity={onUpdateQuantity}
          // New prop for vendor name display on card, now explicitly set to false
          showVendorName={false}
          // Existing props that need to be preserved as they are critical for functionality
          userType={userType}
          selectedHousehold={selectedHousehold} // Preserved from original implementation
          // New prop for language
          language={language}
        />
      ))}
    </div>
  );
}
