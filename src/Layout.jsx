import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { User } from "@/entities/User";
import { CartProvider, useCart } from "./components/cart/CartContext";
import { LanguageProvider, useLanguage } from "./components/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  User as UserIcon,
  Package,
  Home,
  LogOut,
  Store,
  Shield,
  Users,
  Menu,
  X,
  Briefcase,
  Building,
  Globe,
  Rocket,
  Calendar,
  MessageCircle,
  Wrench
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import NotificationCenter from "./components/notifications/NotificationCenter";
import LocalDevLogin from "./components/admin/LocalDevLogin";
import { loginWithZoozzRedirect } from "./components/auth/AuthHelper";
import { Household } from "./entities/Household";
import { AppSettings } from "@/entities/AppSettings"; // Import AppSettings

const UserRoleBanner = ({ userType }) => {
  const { t } = useLanguage();
  
  if (!userType || userType === 'customerApp') return null;

  const styles = {
    admin: {
      bg: 'bg-red-700',
      text: 'text-white',
      icon: <Shield className="w-4 h-4 mr-2" />,
      label: t('userRoles.adminView')
    },
    vendor: {
      bg: 'bg-green-700',
      text: 'text-white',
      icon: <Store className="w-4 h-4 mr-2" />,
      label: t('userRoles.vendorView')
    },
    picker: {
      bg: 'bg-orange-600',
      text: 'text-white',
      icon: <Package className="w-4 h-4 mr-2" />,
      label: t('userRoles.pickerView')
    },
    'kcs staff': {
      bg: 'bg-purple-600',
      text: 'text-white',
      icon: <Users className="w-4 h-4 mr-2" />,
      label: t('userRoles.kcsStaffView')
    },
    'chief of staff': {
      bg: 'bg-blue-700',
      text: 'text-white',
      icon: <Briefcase className="w-4 h-4 mr-2" />,
      label: t('userRoles.chiefOfStaffView')
    },
    'household owner': {
      bg: 'bg-blue-700',
      text: 'text-white',
      icon: <Users className="w-4 h-4 mr-2" />,
      label: t('userRoles.householdOwnerView')
    }
  };

  const style = styles[userType];
  if (!style) return null;

  return (
    <div className={`w-full text-center text-xs font-semibold flex items-center justify-center ${style.bg} ${style.text} fixed top-0 left-0 right-0 z-50 h-[30px]`}>
      {style.icon}
      <span>{style.label}</span>
    </div>
  );
};

function AppLayout({ children, currentPageName }) {
  const { getTotalItemCount } = useCart();
  const { getVendorCartCount } = useCart();
  const { t, language, toggleLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [shoppingForHousehold, setShoppingForHousehold] = useState(null);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);
  const navigate = useNavigate();

  // New state for maintenance mode settings from database
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Debug logging to track state changes
  useEffect(() => {
    console.log('🔍 Layout Debug - State Update:', {
      user: user ? { email: user.email, user_type: user.user_type, vendor_id: user.vendor_id } : null,
      selectedHousehold: selectedHousehold ? { id: selectedHousehold.id, name: selectedHousehold.name } : null,
      shoppingForHousehold: shoppingForHousehold ? { id: shoppingForHousehold.id, name: shoppingForHousehold.name } : null,
      currentPageName,
      maintenanceMode,
      maintenanceMessage,
      timestamp: new Date().toISOString()
    });
  }, [user, selectedHousehold, shoppingForHousehold, currentPageName, maintenanceMode, maintenanceMessage]);

  // Effect 1: Check authentication and maintenance mode ONCE on initial load.
  useEffect(() => {
    const initialAuthCheck = async () => {
      try {
        const [userResult, settingsResult] = await Promise.allSettled([
          User.me(),
          AppSettings.list()
        ]);
        
        // Handle User.me() result
        if (userResult.status === 'fulfilled') {
          setUser(userResult.value);
        } else {
          // console.log('User not authenticated or auth error:', userResult.reason); // Log reason for debugging
          setUser(null);
        }

        // Handle AppSettings.list() result
        if (settingsResult.status === 'fulfilled' && settingsResult.value && settingsResult.value.length > 0) {
          const settings = settingsResult.value[0]; // Assuming there's only one AppSettings document
          setMaintenanceMode(settings.maintenanceMode || false);
          setMaintenanceMessage(settings.maintenanceMessage || '');
        } else if (settingsResult.status === 'rejected') {
          console.error("Failed to load AppSettings for maintenance mode:", settingsResult.reason);
          setMaintenanceMode(false); // Default to not in maintenance if settings fetch fails
        } else {
          setMaintenanceMode(false); // Default to not in maintenance if no settings found
        }

      } catch (error) { // This catch would only trigger if Promise.allSettled itself throws, which is rare.
        console.error('Unexpected error during initial auth/settings check:', error);
        setUser(null);
        setMaintenanceMode(false); // Default to not in maintenance if there's an unexpected error
        setMaintenanceMessage('');
      } finally {
        setInitialAuthCheckDone(true);
        setIsLoading(false);
      }
    };
    initialAuthCheck();
  }, []);

  // Effect 2: Optimized redirection logic. Runs after auth check is complete.
  useEffect(() => {
    if (!initialAuthCheckDone) {
      return; // Wait for the initial authentication check to complete.
    }

    // --- Part A: Setup session for Household Owner ---
    // If the user is a household owner with an assigned household, ensure their
    // session is configured for shopping. This is done outside the redirection
    // logic so they can land on any page and have the correct context.
    if (user?.user_type === 'household owner' && user.household_id) {
        const householdData = sessionStorage.getItem('selectedHousehold');
        const needsToSetHousehold = !householdData || JSON.parse(householdData).id !== user.household_id;

        if (needsToSetHousehold) {
            (async () => {
              try {
                const household = await Household.get(user.household_id);
                if (household) {
                  // Structure the data to be consistent with what KCS staff selection would do.
                  // An owner can always order for their own household.
                  const householdContext = { ...household, canOrder: true };
                  sessionStorage.setItem('selectedHousehold', JSON.stringify(householdContext));
                  window.dispatchEvent(new Event('shoppingModeChanged'));
                } else {
                  console.error(`Data integrity issue: Household with ID ${user.household_id} not found for user ${user.email}.`);
                }
              } catch (error) {
                console.warn('Could not automatically set household context for owner:', error);
              }
            })();
        }
    }


    // --- Part B: Redirection Logic ---
    // This function determines the single correct destination for the user.
    const getTargetUrl = () => {
      // Pages that users must complete setup on. We should not redirect away from them.
      const setupPages = ['UserSetup', 'StaffSetup', 'VendorSetup', 'VendorPendingApproval', 'AuthCallback', 'AuthError', 'HouseholdPendingApproval'];
      if (setupPages.includes(currentPageName)) {
        return null; // Do not redirect if user is already on a required setup page.
      }
      
      // If user is not logged in, no redirect is needed.
      if (!user) {
        return null;
      }

      const userType = user.user_type?.trim();
      const isInShoppingMode = !!sessionStorage.getItem('shoppingForHousehold');

      // --- Redirection Priority ---
      // 1. User has no type assigned -> Must go to UserSetup.
      if (!userType) {
        return createPageUrl("UserSetup");
      }
      // 2. Vendor or Picker is not yet approved (no vendor_id) -> Must go to Pending page.
      if ((userType === 'vendor' || userType === 'picker') && !user.vendor_id) {
        return createPageUrl("VendorPendingApproval");
      }
      if ((userType === 'vendor' || userType === 'picker') && user.role !== 'admin') {
        return createPageUrl("VendorPendingApproval");
      }
      // 3. KCS Staff setup flow.
      if (userType === 'kcs staff') {
        // 3a. Profile is incomplete -> Must go to staff setup.
        if (!user.shirt_size && currentPageName !== 'StaffSetup') {
          return createPageUrl('StaffSetup');
        }
        // 3b. Profile is complete but no household selected -> Must go to selector.
        // We also check they aren't on their profile page, in case they want to edit it.
        if (user.shirt_size && !sessionStorage.getItem('selectedHousehold') && currentPageName !== 'Profile' && currentPageName !== 'HouseholdSelector') {
          return createPageUrl('HouseholdSelector');
        }
      }

      // 4. Role-based dashboard redirects (Only from 'Home' page and not in shopping mode).
      if (currentPageName === 'Home' ) {
        if ((userType === 'admin' || userType === 'chief of staff')&& !isInShoppingMode) {
          return createPageUrl("AdminDashboard");
        }
        if ((userType === 'vendor' || userType === 'picker') && user.vendor_id) {
          return createPageUrl("VendorDashboard");
        }
      }
      //5. if the user is household owner
       if (userType === 'household owner') {
          console.log('🏠 Household Owner Debug:', {
            email: user.email,
            household_id: user.household_id,
            household_id_type: typeof user.household_id,
            has_household_id: !!user.household_id,
            currentPageName: currentPageName
          });
          
          // If the owner is not yet assigned to a household, they must wait on the pending page.
          if (!user.household_id || user.household_id === '' || user.household_id === null) {
            console.log('🏠 Redirecting household owner to pending approval - no household assigned');
            return createPageUrl("HouseholdPendingApproval");
          }
          
          console.log('🏠 Household owner has household assigned, allowing normal flow');
          // Otherwise, no specific redirection is needed. The session setup logic above handles their context.
          return null; // Explicitly return null to prevent any redirect
       } 
      // If no other conditions are met, no redirect is needed.
      return null;
    };

    const targetUrl = getTargetUrl();
    const currentUrl = createPageUrl(currentPageName);

    console.log('🔄 Redirect Check:', { 
      currentPageName, 
      targetUrl, 
      currentUrl,
      userType: user?.user_type,
      household_id: user?.household_id 
    });

    if (targetUrl && targetUrl !== currentUrl) {
      console.log('🔄 Performing redirect to:', targetUrl);
      navigate(targetUrl, { replace: true });
    } else {
      console.log('🔄 No redirect needed');
    }
  }, [user, initialAuthCheckDone, currentPageName, navigate]);

  // Effect 3: Listen for household changes in sessionStorage
  useEffect(() => {
    const handleStorageChange = () => {
      console.log('📦 Layout Debug - Storage change detected');
      // For KCS customer
      if (user?.user_type === 'kcs staff' || user?.user_type === 'household owner') {
        const householdData = sessionStorage.getItem('selectedHousehold');
        const household = householdData ? JSON.parse(householdData) : null;
        console.log('🏠 Layout Debug - Updating selected household from storage:', household);
        setSelectedHousehold(household);
      }
      // For Vendor/Picker/Admin/Chief of Staff
      if (['vendor', 'picker', 'admin', 'chief of staff'].includes(user?.user_type)) {
        const shoppingData = sessionStorage.getItem('shoppingForHousehold');
        const shopping = shoppingData ? JSON.parse(shoppingData) : null;
        console.log('🛒 Layout Debug - Updating shopping household from storage:', shopping);
        setShoppingForHousehold(shopping);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('shoppingModeChanged', handleStorageChange);
    
    // Initial check
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('shoppingModeChanged', handleStorageChange);
    };
  }, [user]);

  const handleLogout = async () => {
    // Clear all session and local storage preferences
    sessionStorage.removeItem('selectedHousehold');
    sessionStorage.removeItem('shoppingForHousehold');
    localStorage.removeItem('appLanguage'); // Ensures language preference is reset

    // Perform the logout action via the SDK
    await User.logout();

    // Force a hard redirect to the Home page.
    // This ensures a full page reload and a completely clean state.
    window.location.href = createPageUrl("Home");
  };

  const handleLogin = () => {
    loginWithZoozzRedirect();
  };

  const getNavItemsForUserType = () => {
    if (!user) {
      return [
        { name: t('navigation.home'), icon: Home, path: "Home" },
        { name: t('navigation.products'), icon: Package, path: "Products" }
      ];
    }
    
    const userType = user.user_type ? user.user_type.trim() : '';

    switch (userType) {
      case "vendor":
      case "picker":
        // Only show dashboard if vendor_id is assigned, otherwise "Pending Approval"
        return user.vendor_id ? 
          [{ name: t('navigation.dashboard'), icon: Store, path: "VendorDashboard" }] :
          [{ name: t('navigation.pendingApproval'), icon: Store, path: "VendorPendingApproval" }];
      case "admin":
      case "chief of staff":
        return [
          { name: t('navigation.dashboard'), icon: Shield, path: "AdminDashboard" }
        ];
      case "kcs staff":
        if (!selectedHousehold) {
          return [];
        }
        return [
          { name: t('navigation.switchHousehold'), icon: Users, path: "HouseholdSelector" },
          { name: t('navigation.home'), icon: Home, path: "Home" },
          { name: t('navigation.products'), icon: Package, path: "Products" },
          { name: t('navigation.orders'), icon: Package, path: "Orders" },
          { name: t('navigation.chat'), icon: MessageCircle, path: "Chat" },
          { name: t('navigation.mealCalendar'), icon: Calendar, path: "MealCalendar" }
        ];
      case "household owner":
        return [
          { name: t('navigation.home'), icon: Home, path: "Home" },
          { name: t('navigation.mealCalendar'), icon: Calendar, path: "MealCalendar" }
        ];
      default:
        return [
          { name: t('navigation.home'), icon: Home, path: "Home" },
          { name: t('navigation.products'), icon: Package, path: "Products" },
          { name: t('navigation.orders'), icon: Package, path: "Orders" }
        ];
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Define banner heights for layout calculation
  const roleBannerHeight = useMemo(() => (user?.user_type && user.user_type !== 'customerApp') ? 30 : 0, [user?.user_type]);
  const householdBannerHeight = useMemo(() => ((user?.user_type === 'kcs staff' || user?.user_type === 'household owner') && selectedHousehold) ? 40 : 0, [user?.user_type, selectedHousehold]);
  const shoppingBannerHeight = useMemo(() => (['vendor', 'picker', 'admin', 'chief of staff'].includes(user?.user_type) && shoppingForHousehold) ? 40 : 0, [user?.user_type, shoppingForHousehold]);
  const totalBannerHeight = useMemo(() => roleBannerHeight + householdBannerHeight + shoppingBannerHeight, [roleBannerHeight, householdBannerHeight, shoppingBannerHeight]);
  const mainHeaderHeight = 64;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loadingSession')}</p>
        </div>
      </div>
    );
  }

  // Show maintenance page for all users except admins
  if (maintenanceMode && user?.user_type !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Wrench className="w-10 h-10 text-yellow-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {language === 'Hebrew' ? 'אתר בתחזוקה' : 'Site Under Maintenance'}
            </h1>
            <p className="text-gray-600 mb-4">
              {maintenanceMessage || (
                language === 'Hebrew' 
                  ? 'אנחנו מבצעים שדרוגים כדי לשפר את החוויה שלך'
                  : "We're performing upgrades to improve your experience"
              )}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                {language === 'Hebrew'
                  ? 'נחזור בקרוב! תודה על הסבלנות'
                  : "We'll be back soon! Thank you for your patience"}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Rocket className="w-4 h-4" />
              <span>Zoozz</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If the current page is one of the setup pages, render children directly without layout.
  // This ensures setup pages have full control over their UI without header/footer interference.
  if (currentPageName === 'UserSetup' || currentPageName === 'StaffSetup' || currentPageName === 'VendorSetup' || currentPageName === 'VendorPendingApproval' || currentPageName === 'HouseholdPendingApproval') {
    return <>{children}</>;
  }

  const navItems = getNavItemsForUserType();
  const cartItemCount = (user?.user_type === 'vendor' || user?.user_type === 'picker') ? getVendorCartCount(user?.vendor_id) : getTotalItemCount();
  const showMainNavigation = !(user?.user_type === 'kcs staff' && !selectedHousehold);
  
  const showCart = showMainNavigation && (
    user?.user_type === 'customerApp' || 
    user?.user_type === 'kcs staff' || 
    user?.user_type === 'household owner' ||
    ((user?.user_type === 'vendor' || user?.user_type === 'picker') && shoppingForHousehold) ||
    ((user?.user_type === 'admin' || user?.user_type === 'chief of staff') && shoppingForHousehold)
  );

  return (
    <div className="min-h-screen bg-gray-50" translate="no">
      {window.location.hostname === 'localhost' && <LocalDevLogin />}
      {/* Role banner */}
      <UserRoleBanner userType={user?.user_type} />
      
      {/* Vendor/Admin/Chief of Staff Shopping Mode Banner */}
      {(['vendor', 'picker', 'admin', 'chief of staff'].includes(user?.user_type)) && shoppingForHousehold && (
        <div 
          className="w-full bg-blue-600 text-white text-center text-sm font-medium fixed left-0 right-0 z-50 h-[40px] flex items-center justify-center px-2"
          style={{ top: `${roleBannerHeight}px` }}
        >
          <Building className="w-4 h-4 inline mr-2" />
          {t('banners.shoppingFor')} <span className="font-semibold">
            {language === 'English' ? shoppingForHousehold.name : (shoppingForHousehold.name_hebrew || shoppingForHousehold.name)}
          </span>
           <Button 
            variant="ghost" 
            size="sm" 
            className="ml-3 text-blue-100 hover:text-white hover:bg-blue-700 h-6 text-xs"
            onClick={() => {
              sessionStorage.removeItem('shoppingForHousehold');
              window.dispatchEvent(new Event('shoppingModeChanged'));
              const dashboardPath = (user?.user_type === 'admin' || user?.user_type === 'chief of staff') ? "AdminDashboard" : "VendorDashboard";
              navigate(createPageUrl(dashboardPath));
            }}
          >
            {t('buttons.exitShoppingMode')}
          </Button>
        </div>
      )}

      {/* Household Banner for KCS Users and Household Owners */}
      {(user?.user_type === 'kcs staff' || user?.user_type === 'household owner'  ) && selectedHousehold && (
        <div 
          className="w-full bg-purple-600 text-white text-center text-sm font-medium fixed left-0 right-0 z-50 h-[40px] flex items-center justify-center px-2"
          style={{ top: `${roleBannerHeight + shoppingBannerHeight}px` }}
        >
          <Home className="w-4 h-4 inline mr-2" />
          {user?.user_type === 'household owner' 
            ? t('banners.yourHousehold') 
            : t('banners.shoppingFor')
          } <span className="font-semibold">
            {language === 'English' ? selectedHousehold.name : (selectedHousehold.name_hebrew || selectedHousehold.name)}
          </span>
          {user?.user_type === 'kcs staff' && ( // Only show switch button for KCS staff
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-3 text-purple-100 hover:text-white hover:bg-purple-700 h-6 text-xs"
              onClick={() => {
                closeMobileMenu();
                navigate(createPageUrl("HouseholdSelector"));
              }}
            >
              {t('buttons.switchHousehold')}
            </Button>
          )}
        </div>
      )}

      {/* Main header */}
      <header 
        className="bg-white shadow-sm border-b fixed left-0 right-0 z-40" 
        style={{ top: `${totalBannerHeight}px`, height: `${mainHeaderHeight}px` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link 
              to={createPageUrl(
                user?.user_type === 'vendor' || user?.user_type === 'picker' 
                  ? (user?.vendor_id ? "VendorDashboard" : "VendorPendingApproval")
                  : user?.user_type === 'admin' || user?.user_type === 'chief of staff'
                  ? "AdminDashboard"
                  : "Home"
              )} 
              className="flex items-center"
            >
              <Rocket className="text-green-600 mr-2 w-8 h-8" />
              <span className="font-bold text-gray-900 text-xl">
                {language === 'Hebrew' ? 'זוזז' : 'Zoozz'}
              </span>
            </Link>

            {showMainNavigation && (
              <nav className="hidden md:flex space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.path)}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                      currentPageName === item.path
                        ? "text-green-600 bg-green-50"
                        : "text-gray-700 hover:text-green-600 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon className="mr-2 w-4 h-4" />
                    {item.name}
                  </Link>
                ))}
              </nav>
            )}

            <div className="hidden md:flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                className="h-9 px-3"
                onClick={toggleLanguage}
              >
                <Globe className="w-4 h-4 mr-2" />
                {language === 'English' ? 'עברית' : 'English'}
              </Button>

              {showCart && (
                <Link to={createPageUrl("Cart")} className="relative">
                  <Button variant="ghost" size="icon">
                    <ShoppingCart className="w-5 h-5" />
                    {cartItemCount > 0 && (
                      <Badge className={`absolute text-white min-w-[20px] h-5 flex items-center justify-center text-xs -top-2 -right-2 ${
                        (user?.user_type === 'vendor' || user?.user_type === 'picker' || user?.user_type === 'admin' || user?.user_type === 'chief of staff') && shoppingForHousehold
                          ? 'bg-purple-600'
                          : 'bg-green-600'
                      }`}>
                        {cartItemCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )}
              
              {user ? (
                <div className="flex items-center space-x-2">
                  <NotificationCenter />
                  <Link to={createPageUrl("Profile")}>
                    <Button variant="ghost" size="icon">
                      <UserIcon className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button onClick={handleLogin} className="bg-green-600 hover:bg-green-700 text-sm px-4 py-2">
                  {t('auth.signInRegister')}
                </Button>
              )}
            </div>

            <div className="md:hidden flex items-center space-x-2">
              {showCart && (
                <Link to={createPageUrl("Cart")} className="relative">
                  <Button variant="ghost" size="icon">
                    <ShoppingCart className="w-5 h-5" />
                    {cartItemCount > 0 && (
                      <Badge className={`absolute text-white min-w-[20px] h-5 flex items-center justify-center text-xs -top-2 -right-2 ${
                        (user?.user_type === 'vendor' || user?.user_type === 'picker' || user?.user_type === 'admin' || user?.user_type === 'chief of staff') && shoppingForHousehold
                          ? 'bg-purple-600'
                          : 'bg-green-600'
                      }`}>
                        {cartItemCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )}
              {user && <NotificationCenter />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={createPageUrl(item.path)}
                  onClick={closeMobileMenu}
                  className={`flex items-center px-3 py-3 rounded-md text-base font-medium transition-colors ${
                    currentPageName === item.path
                      ? "text-green-600 bg-green-50"
                      : "text-gray-700 hover:text-green-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              ))}
              
              <div className="border-t pt-2 mt-2">
                <button
                  onClick={() => {
                    toggleLanguage();
                    closeMobileMenu();
                  }}
                  className="flex items-center w-full px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
                >
                  <Globe className="w-5 h-5 mr-3" />
                  {language === 'English' ? t('language.switchToHebrew') : t('language.switchToEnglish')}
                </button>

                {user ? (
                  <>
                    <Link
                      to={createPageUrl("Profile")}
                      onClick={closeMobileMenu}
                      className="flex items-center px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
                    >
                      <UserIcon className="w-5 h-5 mr-3" />
                      {t('navigation.profile')}
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        closeMobileMenu();
                      }}
                      className="flex items-center w-full px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      {t('auth.signOut')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      handleLogin();
                      closeMobileMenu();
                    }}
                    className="flex items-center w-full px-3 py-3 rounded-md text-base font-medium bg-green-600 text-white hover:bg-green-700"
                  >
                    {t('auth.signInRegister')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      
      {/* Main content */}
      <main style={{
        paddingTop: `${totalBannerHeight + mainHeaderHeight}px`
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand Section */}
            <div>
              <div className="flex items-center mb-4">
                <Rocket className="text-green-600 mr-2 w-6 h-6" />
                <span className="font-bold text-gray-900 text-lg">
                  {language === 'Hebrew' ? 'זוזז' : 'Zoozz'}
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                {language === 'Hebrew' 
                  ? 'פתרון קניות חכם עבור משפחות ומוסדות'
                  : 'Smart shopping solution for families and institutions'
                }
              </p>
            </div>

            {/* Links Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                {language === 'Hebrew' ? 'קישורים' : 'Links'}
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link 
                    to={createPageUrl("TermsOfService")} 
                    className="text-gray-600 hover:text-green-600 text-sm transition-colors"
                  >
                    {language === 'Hebrew' ? 'תנאי שירות' : 'Terms of Service'}
                  </Link>
                </li>
                <li>
                  <Link 
                    to={createPageUrl("Home")} 
                    className="text-gray-600 hover:text-green-600 text-sm transition-colors"
                  >
                    {language === 'Hebrew' ? 'דף הבית' : 'Home'}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                {language === 'Hebrew' ? 'צור קשר' : 'Contact'}
              </h3>
              <p className="text-gray-600 text-sm">
                {language === 'Hebrew' ? 'דוא״ל' : 'Email'}: support@zoozz.com
              </p>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Zoozz. {language === 'Hebrew' ? 'כל הזכויות שמורות' : 'All rights reserved'}.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <CartProvider>
        <AppLayout currentPageName={currentPageName}>
          {children}
        </AppLayout>
      </CartProvider>
    </LanguageProvider>
  );
}