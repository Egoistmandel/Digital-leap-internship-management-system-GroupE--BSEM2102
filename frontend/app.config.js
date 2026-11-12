/**
 * Expo App Configuration
 * Digital LEAP Internship Management System
 *
 * This file extends app.json with environment-specific settings.
 * API base URL is read from an environment variable so it is
 * never hardcoded into the production build.
 *
 * Usage:
 *   Development: set API_BASE_URL in your .env or shell
 *   Production:  set API_BASE_URL in Vercel environment variables
 */

export default ({ config }) => ({
  ...config,
  extra: {
    // Set API_BASE_URL in your environment before building.
    // Example for XAMPP local dev:   http://192.168.1.X/digital-leap-api
    // Example for production:        https://your-api-host.com/api
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://192.168.1.100/digital-leap-api',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
