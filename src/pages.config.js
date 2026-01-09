import Home from './pages/Home';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Vendor from './pages/Vendor';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import UserSetup from './pages/UserSetup';
import Households from './pages/Households';
import BulkImageUploader from './pages/BulkImageUploader';
import ImageMatcher from './pages/ImageMatcher';
import HouseholdSelector from './pages/HouseholdSelector';
import KCSProfileSetup from './pages/KCSProfileSetup';
import Debug from './pages/Debug';
import VendorSetup from './pages/VendorSetup';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import VendorPendingApproval from './pages/VendorPendingApproval';
import MealCalendar from './pages/MealCalendar';
import HouseholdPendingApproval from './pages/HouseholdPendingApproval';
import HouseholdSetup from './pages/HouseholdSetup';
import HouseholdOwnerSignup from './pages/HouseholdOwnerSignup';
import ProcessImageZip from './pages/ProcessImageZip';
import Chat from './pages/Chat';
import PdfTest from './pages/PdfTest';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import StaffSetup from './pages/StaffSetup';
import VendorSignup from './pages/VendorSignup';
import KCSStaffSignup from './pages/KCSStaffSignup';
import TermsOfService from './pages/TermsOfService';
import TimeTracking from './pages/TimeTracking';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Products": Products,
    "Cart": Cart,
    "Orders": Orders,
    "Profile": Profile,
    "Vendor": Vendor,
    "VendorDashboard": VendorDashboard,
    "AdminDashboard": AdminDashboard,
    "UserSetup": UserSetup,
    "Households": Households,
    "BulkImageUploader": BulkImageUploader,
    "ImageMatcher": ImageMatcher,
    "HouseholdSelector": HouseholdSelector,
    "KCSProfileSetup": KCSProfileSetup,
    "Debug": Debug,
    "VendorSetup": VendorSetup,
    "AuthCallback": AuthCallback,
    "AuthError": AuthError,
    "VendorPendingApproval": VendorPendingApproval,
    "MealCalendar": MealCalendar,
    "HouseholdPendingApproval": HouseholdPendingApproval,
    "HouseholdSetup": HouseholdSetup,
    "HouseholdOwnerSignup": HouseholdOwnerSignup,
    "ProcessImageZip": ProcessImageZip,
    "Chat": Chat,
    "PdfTest": PdfTest,
    "PaymentSuccess": PaymentSuccess,
    "PaymentCancel": PaymentCancel,
    "StaffSetup": StaffSetup,
    "VendorSignup": VendorSignup,
    "KCSStaffSignup": KCSStaffSignup,
    "TermsOfService": TermsOfService,
    "TimeTracking": TimeTracking,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};