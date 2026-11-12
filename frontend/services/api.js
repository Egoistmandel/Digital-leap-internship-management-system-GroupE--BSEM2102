/**
 * API Service — Digital LEAP
 *
 * Central HTTP client for all backend communication.
 * - All requests go to the PHP backend via REST.
 * - Bearer token is attached automatically when available.
 * - Errors are normalised into a consistent shape.
 * - Never connect directly to MySQL from the frontend.
 */

import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Base URL — update this to match your XAMPP setup or production host
// ---------------------------------------------------------------------------
// For mobile (Expo Go), use your computer's LAN IP:
const BASE_URL = 'http://192.168.0.158/digital-leap-api';
// For Android emulator use: http://10.0.2.2/digital-leap-api
// For web / iOS simulator use: http://localhost/digital-leap-api
// For production: replace with your hosted domain

const TOKEN_KEY = 'leap_auth_token';

// ---------------------------------------------------------------------------
// Token helpers (SecureStore for mobile, fallback for web)
// ---------------------------------------------------------------------------
export async function saveToken(token) {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Web fallback
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
}

export async function getToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }
}

export async function removeToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------
async function request(method, endpoint, body = null, requiresAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = { method, headers };
  if (body !== null) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}/${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      // Return normalised error shape
      return {
        success: false,
        message: data.message ?? 'An error occurred.',
        errors:  data.errors  ?? {},
        status:  response.status,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      message: 'Could not connect to the server. Please check your connection.',
      errors:  {},
      status:  0,
    };
  }
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------
export const authService = {
  register: (payload) =>
    request('POST', 'auth/register', payload, false),

  login: (email, password) =>
    request('POST', 'auth/login', { email, password }, false),

  logout: () =>
    request('POST', 'auth/logout'),

  unlockUser: (userId) =>
    request('POST', `auth/unlock/${userId}`),
};

// ---------------------------------------------------------------------------
// Placeholder services — to be implemented in Milestones 4–7
// ---------------------------------------------------------------------------
export const userService = {
  getProfile:       (userId)          => request('GET',   `users/${userId}`),
  updateProfile:    (userId, payload) => request('PUT',   `users/${userId}`, payload),
  listPending:      ()                => request('GET',   'users/pending'),
  updateStatus:     (userId, payload) => request('PATCH', `users/${userId}/status`, payload),
  updateEligibility:(userId, payload) => request('PATCH', `users/${userId}/eligibility`, payload),
};

export const hostService = {
  list:         ()         => request('GET',  'hosts'),
  create:       (payload)  => request('POST', 'hosts', payload),
  get:          (id)       => request('GET',  `hosts/${id}`),
  updateStatus: (id, p)    => request('PATCH', `hosts/${id}/status`, p),
  addVacancy:   (orgId, p) => request('POST', `hosts/${orgId}/vacancies`, p),
};

export const placementService = {
  list:         ()        => request('GET',  'placements'),
  apply:        (payload) => request('POST', 'placements', payload),
  get:          (id)      => request('GET',  `placements/${id}`),
  updateStatus: (id, p)   => request('PATCH',`placements/${id}/status`, p),
};

export const logbookService = {
  list:   (placementId) => request('GET',  `placements/${placementId}/logbook`),
  submit: (placementId, payload) =>
    request('POST', `placements/${placementId}/logbook`, payload),
  review: (entryId, payload) =>
    request('PATCH', `logbook/${entryId}/review`, payload),
};

export const assessmentService = {
  getComponents:    ()               => request('GET',   'assessment/components'),
  createComponent:  (payload)        => request('POST',  'assessment/components', payload),
  updateComponent:  (id, payload)    => request('PATCH', `assessment/components/${id}`, payload),
  getGradeConfig:   ()               => request('GET',   'grades/config'),
  saveGradeConfig:  (payload)        => request('POST',  'grades/config', payload),
  submitMarks:      (payload)        => request('POST',  'assessment/marks', payload),
  submitEvaluation: (pid, payload)   => request('POST', `evaluation/${pid}`, payload),
  getEvaluation:    (pid)            => request('GET',   `evaluation/${pid}`),
  getGrade:         (pid)            => request('GET',   `grades/${pid}`),
  listAllGrades:    ()               => request('GET',   'grades/all'),
  computeGrade:     (pid)            => request('POST',  `grades/${pid}/compute`),
  verifyGrade:      (pid)            => request('PATCH', `grades/${pid}/verify`),
  approveGrade:     (pid, payload)   => request('PATCH', `grades/${pid}/approve`, payload),
  publishGrade:     (pid)            => request('PATCH', `grades/${pid}/publish`),
};

export const visitService = {
  list:         ()           => request('GET',  'visits'),
  schedule:     (payload)    => request('POST', 'visits', payload),
  submitReport: (id, payload) => request('POST', `visits/${id}/report`, payload),
};

export const notificationService = {
  list:    () => request('GET', 'notifications'),
  markRead:(id) => request('PATCH', `notifications/${id}/read`),
};

export const attendanceService = {
  record:  (payload)      => request('POST',  'attendance', payload),
  list:    (placementId)  => request('GET',   `attendance/${placementId}`),
  verify:  (id, payload)  => request('PATCH', `attendance/${id}/verify`, payload),
};

export const reportService = {
  placements: () => request('GET', 'reports/placements'),
  progress:   () => request('GET', 'reports/progress'),
  results:    () => request('GET', 'reports/results'),
};
