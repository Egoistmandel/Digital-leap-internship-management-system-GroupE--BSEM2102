<?php
/**
 * CORS Configuration
 * Digital LEAP Internship Management System
 *
 * Restricts cross-origin requests to approved frontend origins only.
 * Update ALLOWED_ORIGINS when deploying to production.
 */

$allowed_origins = [
    'http://localhost:8081',   // Expo web dev server
    'http://localhost:8082',   // Expo web dev server (alternate)
    'http://localhost:19006',  // Expo web alternate port
    'http://localhost:3000',   // Local testing
    // Add your Vercel production URL here when deploying:
    // 'https://your-app.vercel.app',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    // During local development allow all; restrict in production
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
