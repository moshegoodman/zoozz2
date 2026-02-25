/**
 * Price utility functions for currency conversion and formatting
 */

const ILS_TO_USD_RATE = 3.24;

/**
 * Convert ILS price to USD
 * @param {number} priceILS - Price in Israeli Shekels
 * @returns {number} Price in USD
 */
export function convertToUSD(priceILS) {
  return priceILS / ILS_TO_USD_RATE;
}

/**
 * Format price based on language
 * @param {number} priceILS - Price in Israeli Shekels
 * @param {string} language - 'English' or 'Hebrew'
 * @returns {string} Formatted price string
 */
export function formatPrice(priceILS, language) {
  return `₪${Number(priceILS).toFixed(2)}`;
}

/**
 * Get currency symbol
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(language) {
  return '₪';
}

/**
 * Get display price value
 * @param {number} priceILS - Price in Israeli Shekels
 * @returns {number} Display price value
 */
export function getDisplayPrice(priceILS, language) {
  return priceILS;
}