import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

/**
 * Improved login function that always redirects back to zoozz.shop
 */
export const loginWithZoozzRedirect = (intendedDestination = null) => {
  try {
    const nextUrl = intendedDestination || window.location.href;
    base44.auth.redirectToLogin(nextUrl);
  } catch (error) {
    console.error('redirectToLogin failed:', error);
    // Fallback: redirect directly to base44 login
    window.location.href = 'https://base44.com/login';
  }
};

/**
 * Enhanced logout function that ensures clean session reset
 */
export const logoutWithCleanup = async () => {
  try {
    // Clear all session and local storage related to auth and app state
    sessionStorage.removeItem('entryRoutedV2');
    sessionStorage.removeItem('selectedHousehold');
    sessionStorage.removeItem('shoppingForHousehold');
    sessionStorage.removeItem('postLoginDestination');
    localStorage.removeItem('appLanguage');
    
    // Perform the logout
    await User.logout();
    
    // Force redirect to home page to ensure clean state
    window.location.href = createPageUrl('Home');
  } catch (error) {
    console.error('Logout failed:', error);
    // Even if logout fails, redirect to home
    window.location.href = createPageUrl('Home');
  }
};

/**
 * Check authentication status safely
 */
export const checkAuthStatus = async () => {
  try {
    const user = await User.me();
    return { isAuthenticated: true, user };
  } catch (error) {
    return { isAuthenticated: false, user: null, error: error.message };
  }
};