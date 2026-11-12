<?php
/**
 * API Entry Point
 * Digital LEAP Internship Management System
 *
 * All requests are routed through this file via .htaccess.
 * Applies CORS headers and delegates to the router.
 */

// Load environment variables from .env (local dev only)
require_once __DIR__ . '/config/env.php';

// Apply CORS headers first (handles OPTIONS preflight)
require_once __DIR__ . '/config/cors.php';

// Load response utility for top-level error handling
require_once __DIR__ . '/utils/Response.php';

// Route the request
try {
    require_once __DIR__ . '/routes/api.php';
} catch (Throwable $e) {
    error_log('Unhandled error in API: ' . $e->getMessage());
    Response::serverError();
}
