// Helpers for managing the user's currently active role when they have multiple roles.
// The active role is stored in localStorage so it persists across reloads but is per-device.

const ACTIVE_ROLE_KEY = 'activeUserRole';
const ACTIVE_VENDOR_KEY = 'activeVendorId';

export function getActiveRole() {
  try {
    return localStorage.getItem(ACTIVE_ROLE_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveRole(role) {
  try {
    if (role) localStorage.setItem(ACTIVE_ROLE_KEY, role);
    else localStorage.removeItem(ACTIVE_ROLE_KEY);
  } catch {}
}

export function getActiveVendorId() {
  try {
    return localStorage.getItem(ACTIVE_VENDOR_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveVendorId(vendorId) {
  try {
    if (vendorId) localStorage.setItem(ACTIVE_VENDOR_KEY, vendorId);
    else localStorage.removeItem(ACTIVE_VENDOR_KEY);
  } catch {}
}

// Returns the list of roles the user can act as.
// Merges both `user_type` (legacy single-role) and `user_types` (new multi-role array)
// so users that still only have the legacy field are still recognised.
export function getUserRoles(user) {
  if (!user) return [];
  const list = Array.isArray(user.user_types) ? [...user.user_types] : [];
  if (user.user_type && !list.includes(user.user_type)) {
    list.push(user.user_type);
  }
  return list;
}

// Returns a user object with user_type (and vendor_id when applicable) overridden
// to reflect the currently active role. Single-role users are unchanged.
export function applyActiveRole(user) {
  if (!user) return user;
  const roles = getUserRoles(user);
  if (roles.length <= 1) return user;

  const stored = getActiveRole();
  const activeRole = stored && roles.includes(stored) ? stored : roles[0];

  const result = { ...user, user_type: activeRole };

  // If active role is vendor/picker/driver and user has multiple vendor_ids, apply the active one
  if (['vendor', 'picker', 'driver'].includes(activeRole) && Array.isArray(user.vendor_ids) && user.vendor_ids.length > 0) {
    const storedVendor = getActiveVendorId();
    const activeVendor = storedVendor && user.vendor_ids.includes(storedVendor) ? storedVendor : user.vendor_ids[0];
    result.vendor_id = activeVendor;
  }

  return result;
}