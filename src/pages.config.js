/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDashboard from './pages/AdminDashboard';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import BulkImageUploader from './pages/BulkImageUploader';
import Cart from './pages/Cart';
import Chat from './pages/Chat';
import Debug from './pages/Debug';
import Home from './pages/Home';
import HouseholdOwnerSignup from './pages/HouseholdOwnerSignup';
import HouseholdPendingApproval from './pages/HouseholdPendingApproval';
import HouseholdSelector from './pages/HouseholdSelector';
import HouseholdSetup from './pages/HouseholdSetup';
import Households from './pages/Households';
import ImageMatcher from './pages/ImageMatcher';
import KCSProfileSetup from './pages/KCSProfileSetup';
import KCSStaffSignup from './pages/KCSStaffSignup';
import MealCalendar from './pages/MealCalendar';
import Orders from './pages/Orders';
import PaymentCancel from './pages/PaymentCancel';
import PaymentSuccess from './pages/PaymentSuccess';
import PdfTest from './pages/PdfTest';
import ProcessImageZip from './pages/ProcessImageZip';
import Products from './pages/Products';
import Profile from './pages/Profile';
import StaffSetup from './pages/StaffSetup';
import TermsOfService from './pages/TermsOfService';
import TimeTracking from './pages/TimeTracking';
import UserSetup from './pages/UserSetup';
import Vendor from './pages/Vendor';
import VendorDashboard from './pages/VendorDashboard';
import VendorPendingApproval from './pages/VendorPendingApproval';
import VendorSetup from './pages/VendorSetup';
import VendorSignup from './pages/VendorSignup';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AuthCallback": AuthCallback,
    "AuthError": AuthError,
    "BulkImageUploader": BulkImageUploader,
    "Cart": Cart,
    "Chat": Chat,
    "Debug": Debug,
    "Home": Home,
    "HouseholdOwnerSignup": HouseholdOwnerSignup,
    "HouseholdPendingApproval": HouseholdPendingApproval,
    "HouseholdSelector": HouseholdSelector,
    "HouseholdSetup": HouseholdSetup,
    "Households": Households,
    "ImageMatcher": ImageMatcher,
    "KCSProfileSetup": KCSProfileSetup,
    "KCSStaffSignup": KCSStaffSignup,
    "MealCalendar": MealCalendar,
    "Orders": Orders,
    "PaymentCancel": PaymentCancel,
    "PaymentSuccess": PaymentSuccess,
    "PdfTest": PdfTest,
    "ProcessImageZip": ProcessImageZip,
    "Products": Products,
    "Profile": Profile,
    "StaffSetup": StaffSetup,
    "TermsOfService": TermsOfService,
    "TimeTracking": TimeTracking,
    "UserSetup": UserSetup,
    "Vendor": Vendor,
    "VendorDashboard": VendorDashboard,
    "VendorPendingApproval": VendorPendingApproval,
    "VendorSetup": VendorSetup,
    "VendorSignup": VendorSignup,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};