const ACCESS_KEY = 'uzdonate_admin_access_token';
const REFRESH_KEY = 'uzdonate_admin_refresh_token';

/**
 * Plain localStorage, not secure storage — there is no browser equivalent of
 * the mobile app's Keystore-backed secure storage. Acceptable for an
 * internal admin tool; see docs/admin-panel.md for the production hardening
 * note (short-lived access token + reverse-proxy IP allowlist / VPN).
 */
export const tokenStore = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
