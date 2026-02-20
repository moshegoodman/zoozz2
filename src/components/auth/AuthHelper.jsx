import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';

/**
 * Improved login function that always redirects back to zoozz.shop
 */
export const loginWithZoozzRedirect = async (intendedDestination = null) => {
  try {
    // Determine the callback URL - always use our auth callback page
    const baseUrl = window.location.origin; // e.g., https://zoozz.shop
    const callbackUrl = `${baseUrl}${createPageUrl('AuthCallback')}`;
    
    // Store intended destination for after login
    if (intendedDestination) {
      sessionStorage.setItem('postLoginDestination', intendedDestination);
    }
    
    // Use loginWithRedirect to ensure we control where the user goes
    await User.loginWithRedirect(callbackUrl);
  } catch (error) {
    console.error('Login initiation failed:', error);
    // Even if login initiation fails, keep user on zoozz.shop
    window.location.href = createPageUrl('AuthError');
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