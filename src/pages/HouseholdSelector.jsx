import React, { useState, useEffect } from "react";
import { User, HouseholdStaff, Household } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, ShoppingCart, Users, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";

export default function HouseholdSelectorPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [householdsWithPermissions, setHouseholdsWithPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserAndHouseholds();
  }, []);

  const loadUserAndHouseholds = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      if (currentUser.user_type === 'kcs staff') {
        // Find households where this user is staff
        const staffAssignments = await HouseholdStaff.filter({ 
          staff_user_id: currentUser.id 
        });
        
        if (staffAssignments.length > 0) {
          const householdIds = staffAssignments.map(staff => staff.household_id);
          const allHouseholds = await Household.list();
          const userHouseholds = allHouseholds.filter(h => householdIds.includes(h.id));
          
          // Combine household data with permission data
          const householdsWithPerms = userHouseholds.map(household => {
            const staffRecord = staffAssignments.find(staff => staff.household_id === household.id);
            return {
              ...household,
              canOrder: staffRecord?.can_order || false,
              jobRole: staffRecord?.job_role || ''
            };
          });
          
          setHouseholdsWithPermissions(householdsWithPerms);
        }
      } else {
        // If user is not KCS Staff, redirect them
        navigate(createPageUrl("Home"));
      }
    } catch (error) {
      console.error("Error loading user and households:", error);
      navigate(createPageUrl("Home")); // Redirect on error
    } finally {
      setIsLoading(false);
    }
  };

  const selectHousehold = (household) => {
    if (!household.canOrder) {
      alert(t('kcsstaff.householdSelector.noPermissionAlert'));
      return;
    }
    
    // Store selected household in sessionStorage
    sessionStorage.setItem('selectedHousehold', JSON.stringify(household));
    // Redirect to home page
    navigate(createPageUrl("Home"));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('kcsstaff.householdSelector.loadingHouseholds')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <Users className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('kcsstaff.householdSelector.title')}</h1>
        <p className="text-gray-600">{t('kcsstaff.householdSelector.description')}</p>
      </div>

      {householdsWithPermissions.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('kcsstaff.householdSelector.noHouseholdsAssigned')}</h3>
            <p className="text-gray-600 mb-6">
              {t('kcsstaff.householdSelector.contactAdmin')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {householdsWithPermissions.map((household) => (
            <Card key={household.id} className={`transition-shadow ${
              household.canOrder 
                ? "hover:shadow-lg cursor-pointer group" 
                : "opacity-75 cursor-not-allowed"
            }`}>
              <CardHeader className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
                  household.canOrder 
                    ? "bg-green-100 group-hover:bg-green-200" 
                    : "bg-gray-100"
                }`}>
                  {household.canOrder ? (
                    <Home className="w-8 h-8 text-green-600" />
                  ) : (
                    <Lock className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  {household.name}
                  {!household.canOrder && (
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      <Lock className="w-3 h-3 mr-1" />
                      {t('kcsstaff.householdSelector.noOrderAccess')}
                    </Badge>
                  )}
                </CardTitle>
                {household.jobRole && (
                  <Badge variant="outline" className="mt-2">
                    {t(`kcsstaff.jobRoles.${household.jobRole}`, household.jobRole)}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="text-center space-y-4">
                {household.kashrut_preferences && household.kashrut_preferences.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">{t('kcsstaff.householdSelector.kashrutPreferences')}:</p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {household.kashrut_preferences.slice(0, 3).map(pref => (
                        <span key={pref} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {pref.replace('_', ' ')}
                        </span>
                      ))}
                      {household.kashrut_preferences.length > 3 && (
                        <span className="text-xs text-gray-500">
                          {t('kcsstaff.householdSelector.morePreferences', { count: household.kashrut_preferences.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={() => selectHousehold(household)}
                  disabled={!household.canOrder}
                  className={`w-full ${
                    household.canOrder 
                      ? "bg-green-600 hover:bg-green-700" 
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  {household.canOrder ? (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {t('kcsstaff.householdSelector.shopForHousehold')}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      {t('kcsstaff.householdSelector.accessRestricted')}
                    </>
                  )}
                </Button>
                
                {!household.canOrder && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t('kcsstaff.householdSelector.requestPermissions')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}