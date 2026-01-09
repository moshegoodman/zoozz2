import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Apple, Milk, Beef, Croissant, ShoppingBasket, Snowflake, Coffee, Cookie, Home } from "lucide-react";

const categories = [
  { name: "Produce", key: "produce", icon: Apple, color: "bg-green-100 text-green-600", image: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&h=200&fit=crop" },
  { name: "Dairy", key: "dairy", icon: Milk, color: "bg-blue-100 text-blue-600", image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=300&h=200&fit=crop" },
  { name: "Meat", key: "meat", icon: Beef, color: "bg-red-100 text-red-600", image: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=300&h=200&fit=crop" },
  { name: "Bakery", key: "bakery", icon: Croissant, color: "bg-orange-100 text-orange-600", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop" },
  { name: "Pantry", key: "pantry", icon: ShoppingBasket, color: "bg-yellow-100 text-yellow-600", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&h=200&fit=crop" },
  { name: "Frozen", key: "frozen", icon: Snowflake, color: "bg-cyan-100 text-cyan-600", image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&h=200&fit=crop" },
  { name: "Beverages", key: "beverages", icon: Coffee, color: "bg-purple-100 text-purple-600", image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop" },
  { name: "Snacks", key: "snacks", icon: Cookie, color: "bg-pink-100 text-pink-600", image: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=300&h=200&fit=crop" },
  { name: "Household", key: "household", icon: Home, color: "bg-gray-100 text-gray-600", image: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=300&h=200&fit=crop" }
];

export default function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {categories.map((category) => (
        <Link key={category.key} to={createPageUrl(`Products?category=${category.key}`)}>
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square">
                <img 
                  src={category.image} 
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className={`p-3 rounded-full ${category.color} bg-white/90 mb-2`}>
                    <category.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg">{category.name}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}