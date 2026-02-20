import React, { useState, useEffect } from "react";
import { Household } from "@/entities/all";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Home, Search, Users, ShoppingCart, Phone, User as UserIcon } from "lucide-react";
import { useLanguage } from '../i18n/LanguageContext';

export default function HouseholdSelectorModal({ isOpen, onClose, onSelect }) {
  const { t, language } = useLanguage();
  const [households, setHouseholds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHouseholds();
    }
  }, [isOpen]);

  const loadHouseholds = async () => {
    setIsLoading(true);
    try {
      const householdsData = await Household.list();
      setHouseholds(householdsData);
      console.log('Households data',householdsData)
    } catch (error) {
      console.error("Error loading households:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHouseholds = households.filter(household =>
    household.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    household.name_hebrew?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    household.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (household) => {
    onSelect(household);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('vendor.householdSelector.title')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t('vendor.householdSelector.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('vendor.householdSelector.loadingHouseholds')}</p>
            </div>
          )}

          {/* Households Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHouseholds.length > 0 ? (
                filteredHouseholds.map((household) => (
                  <Card key={household.id} className="hover:shadow-lg transition-shadow group flex flex-col">
                    <CardHeader className="text-center pb-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center mx-auto mb-3 transition-colors">
                        <Home className="w-6 h-6 text-green-600" />
                      </div>
                      {language === "Hebrew" ? (
                        <p className="text-base text-gray-700 font-medium" style={{ direction: 'rtl' }}>
                          {household.name_hebrew || household.name}
                        </p>
                      ) : (
                        <CardTitle className="text-lg">{household.name}</CardTitle>
                      )}
                    </CardHeader>
                    <CardContent className="text-center space-y-2 flex-grow">
                      <Badge variant="outline" className="text-xs bg-gray-50">
                        Code: {(household.household_code || '').slice(0, 4)}
                      </Badge>
      
                      {household.lead_name && (
                        <div className="text-sm text-gray-800 flex items-center justify-center gap-2 pt-2">
                          <UserIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="truncate font-medium">{household.lead_name}</span>
                        </div>
                      )}

                      {household.lead_phone && (
                        <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span>{household.lead_phone}</span>
                        </div>
                      )}
                      
                      {household.address && (
                        <p className="text-xs text-gray-600 line-clamp-2 pt-1 min-h-[36px]">
                          {household.address}
                        </p>
                      )}
                      
                      {household.kashrut_preferences && household.kashrut_preferences.length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs text-gray-500 mb-2">{t('vendor.householdSelector.kashrutPreferences')}:</p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {household.kashrut_preferences.slice(0, 2).map(pref => (
                              <Badge key={pref} variant="outline" className="text-xs">
                                {pref.replace('_', ' ')}
                              </Badge>
                            ))}
                            {household.kashrut_preferences.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                {t('vendor.householdSelector.morePreferences', { count: household.kashrut_preferences.length - 2 })}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <div className="p-4 pt-2 mt-auto">
                      <Button 
                        onClick={() => handleSelect(household)}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {t('vendor.householdSelector.shopForHousehold')}
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  {searchQuery ? (
                    <>
                      <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vendor.householdSelector.noHouseholdsFound')}</h3>
                      <p className="text-gray-600">{t('vendor.householdSelector.tryAdjusting')}</p>
                    </>
                  ) : (
                    <>
                      <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vendor.householdSelector.noHouseholdsAvailable')}</h3>
                      <p className="text-gray-600">{t('vendor.householdSelector.noHouseholdsSetup')}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}