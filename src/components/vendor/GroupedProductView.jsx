
import React, { useMemo } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "../products/ProductCard";
import { useLanguage } from "../i18n/LanguageContext";

// Function to sanitize IDs, moved here for better scope and reusability
const sanitizeForId = (str) => str.replace(/\s+/g, '-').toLowerCase();

// Renamed component from PaginatedProductGrid and simplified to allow continuous scrolling
const HorizontallyScrollingProductGrid = ({ subcategory, products, userType, language, name_hebrew, onAddToCart, onUpdateQuantity, cartItems, vendor }) => {
  const displayName = language === 'Hebrew' ? (name_hebrew || subcategory) : subcategory;
  const cartItemsMap = useMemo(() => new Map(cartItems.map(item => [item.product_id, item])), [cartItems]);

  return (
    <div key={subcategory} id={sanitizeForId(subcategory)}>
      <div className="mb-2 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 capitalize">
          {displayName}
        </h2>
        {/* Pagination controls have been removed to allow for natural scrolling */}
      </div>
      
      {/* The container for the horizontally scrolling items */}
      <div className="relative">
        <div 
          className="flex overflow-x-auto gap-2 pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        >
          {/* Now mapping over the full `products` array instead of a paginated slice */}
          {products.map((product) => (
            <div 
              key={product.id} 
              className="flex-shrink-0 w-32 sm:w-36"
            >
              <ProductCard 
                product={product} 
                userType={userType} 
                onAddToCart={() => onAddToCart(product)}
                onUpdateQuantity={onUpdateQuantity}
                isInCart={cartItemsMap.has(product.id)}
                cartQuantity={cartItemsMap.get(product.id)?.quantity || 0}
                vendor={vendor}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function GroupedProductView({ groupedProducts, isLoading, userType, onAddToCart, onUpdateQuantity, cartItems, vendor }) {
  const { language } = useLanguage();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-32 mb-1" />
              <div className="flex space-x-1 pb-1">
                {Array(5)
                  .fill(0)
                  .map((_, j) => (
                    <div key={j} className="flex-shrink-0 w-32 sm:w-36 space-y-1">
                      <Skeleton className="aspect-square rounded-lg" />
                      <div className="space-y-1 p-1">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-6 w-1/2" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>
    );
  }

  if (Object.keys(groupedProducts).length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 text-lg mb-2">No products found</div>
        <p className="text-gray-400">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1 sm:p-1 lg:p-1 bg-gray-50">
      {Object.entries(groupedProducts).map(([subcategory, { name_hebrew, products }]) => (
        <HorizontallyScrollingProductGrid
          key={subcategory}
          subcategory={subcategory}
          products={products}
          userType={userType}
          language={language}
          name_hebrew={name_hebrew}
          onAddToCart={onAddToCart}
          onUpdateQuantity={onUpdateQuantity}
          cartItems={cartItems}
          vendor={vendor}
        />
      ))}
    </div>
  );
}
