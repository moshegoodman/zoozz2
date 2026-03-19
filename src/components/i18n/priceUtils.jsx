/**
 * Price utility functions for currency formatting
 */

const US_COUNTRIES = ['usa', 'us', 'united states', 'united states of america', 'america'];

/**
 * Returns true if the vendor is based in the USA
 */
export function isUSDVendor(country) {
  if (!country) return false;
  return US_COUNTRIES.includes(country.trim().toLowerCase());
}

/**
 * Format price based on vendor country
 * Israeli vendors → ₪, American vendors → $
 */
export function formatPrice(price, language, vendorCountry) {
  const amount = Number(price).toFixed(2);
  if (isUSDVendor(vendorCountry)) {
    return `$${amount}`;
  }
  return `₪${amount}`;
}

/**
 * Get currency symbol based on vendor country
 */
export function getCurrencySymbol(vendorCountry) {
  return isUSDVendor(vendorCountry) ? '$' : '₪';
}

/**
 * Get display price value (no conversion needed — prices are stored in native currency)
 */
export function getDisplayPrice(price) {
  return price;
}