import React, { useEffect, useState } from "react";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AlertCircle, ShoppingBag, Home, Users, Store, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const roles = [
  {
    key: "customerApp",
    icon: ShoppingBag,
    title: "App Customer",
    description: "Browse vendors and shop for yourself. Place orders and manage deliveries.",
    color: "green",
    navigateTo: "Home",
  },
  {
    key: "household owner",
    icon: Home,
    title: "Household Owner",
    description: "You have a household managed by KCS. Access your household's shopping and services.",
    color: "blue",
    navigateTo: "HouseholdPendingApproval",
  },
  {
    key: "kcs staff",
    icon: Users,
    title: "KCS Staff",
    description: "You work for KCS and manage households. Shop and coordinate on behalf of households.",
    color: "purple",
    navigateTo: "StaffSetup",
  },
  {
    key: "vendor",
    icon: Store,
    title: "Vendor",
    description: "You sell products through Zoozz. Manage your products, inventory, and orders.",
    color: "orange",
    navigateTo: "VendorSetup",
  },
];

const colorMap = {
  green: {
    border: "border-green-200 hover:border-green-400",
    icon: "bg-green-100 text-green-600",
    button: "bg-green-600 hover:bg-green-700",
    selected: "border-green-500 ring-2 ring-green-200",
  },
  blue: {
    border: "border-blue-200 hover:border-blue-400",
    icon: "bg-blue-100 text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
    selected: "border-blue-500 ring-2 ring-blue-200",
  },
  purple: {
    border: "border-purple-200 hover:border-purple-400",
    icon: "bg-purple-100 text-purple-600",
    button: "bg-purple-600 hover:bg-purple-700",
    selected: "border-purple-500 ring-2 ring-purple-200",
  },
  orange: {
    border: "border-orange-200 hover:border-orange-400",
    icon: "bg-orange-100 text-orange-600",
    button: "bg-orange-600 hover:bg-orange-700",
    selected: "border-orange-500 ring-2 ring-orange-200",
  },
};

export default function UserSetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("choosing"); // choosing, saving, error
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await User.me();
        // If user already has a type (and it's not customerApp which may be a leftover), go home.
        if (currentUser?.user_type && currentUser.user_type !== "customerApp") {
          navigate(createPageUrl("Home"), { replace: true });
        }
      } catch {
        // Not logged in, do nothing
      }
    };
    checkUser();
  }, [navigate]);

  const handleConfirm = async () => {
    if (!selected) return;
    setStatus("saving");
    try {
      await base44.auth.updateMe({ user_type: selected.key });
      navigate(createPageUrl(selected.navigateTo), { replace: true });
    } catch (error) {
      console.error("Error saving role:", error);
      setStatus("error");
    }
  };

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
        <p className="text-gray-600 mb-4">We couldn't save your selection. Please try again.</p>
        <Button onClick={() => setStatus("choosing")} className="bg-green-600 hover:bg-green-700">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Zoozz!</h1>
          <p className="text-gray-500 text-lg">How will you be using the app?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {roles.map((role) => {
            const colors = colorMap[role.color];
            const isSelected = selected?.key === role.key;
            const Icon = role.icon;

            return (
              <Card
                key={role.key}
                onClick={() => setSelected(role)}
                className={`cursor-pointer border-2 transition-all duration-200 ${
                  isSelected ? colors.selected : colors.border
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base mb-1">{role.title}</h3>
                      <p className="text-gray-500 text-sm leading-snug">{role.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleConfirm}
            disabled={!selected || status === "saving"}
            className={`px-8 py-3 text-base font-semibold transition-all ${
              selected ? colorMap[selected.color].button : "bg-gray-300 cursor-not-allowed"
            } text-white`}
          >
            {status === "saving" ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Setting up...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue as {selected?.title || "..."}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}