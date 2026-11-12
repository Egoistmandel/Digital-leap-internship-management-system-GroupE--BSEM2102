/**
 * Auth Hook — Digital LEAP
 *
 * Provides authentication state and actions to all screens.
 * Wraps login/logout/register and persists user data via SecureStore.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authService, saveToken, getToken, removeToken } from '../services/api';
import * as SecureStore from 'expo-secure-store';

const USER_KEY = 'leap_user_data';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start: restore session from secure storage
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const userData = await SecureStore.getItemAsync(USER_KEY);
        if (token && userData) {
          setUser(JSON.parse(userData));
        }
      } catch {
        // Storage unavailable — user will need to log in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Log in with email and password.
   * Returns { success, message } to the calling screen.
   */
  async function login(email, password) {
    const result = await authService.login(email, password);

    if (result.success) {
      await saveToken(result.data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.data.user));
      setUser(result.data.user);
    }

    return { success: result.success, message: result.message };
  }

  /**
   * Log out the current user.
   */
  async function logout() {
    await authService.logout();
    await removeToken();
    try { await SecureStore.deleteItemAsync(USER_KEY); } catch { /* web */ }
    setUser(null);
  }

  /**
   * Register a new account.
   * Returns { success, message, errors } to the calling screen.
   */
  async function register(payload) {
    const result = await authService.register(payload);
    return {
      success: result.success,
      message: result.message,
      errors:  result.errors ?? {},
    };
  }

  /**
   * Check whether the current user holds a given role.
   */
  function hasRole(role) {
    return user?.roles?.includes(role) ?? false;
  }

  /**
   * Check whether the current user holds any of the given roles.
   */
  function hasAnyRole(roles) {
    return roles.some((r) => hasRole(r));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
