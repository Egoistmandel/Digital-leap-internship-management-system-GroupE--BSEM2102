<?php
/**
 * Environment Loader
 * Digital LEAP Internship Management System
 *
 * Loads environment variables from a .env file when running locally.
 * In production, environment variables should be set by the hosting provider
 * directly — do NOT deploy the .env file.
 *
 * Usage: require_once __DIR__ . '/env.php'; at the top of index.php
 * (Already included via database.php which uses getenv())
 */

$env_file = dirname(__DIR__) . '/.env';

if (file_exists($env_file)) {
    $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) continue;

        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value);

            // Strip surrounding quotes if present
            if (preg_match('/^["\'](.+)["\']$/', $value, $m)) {
                $value = $m[1];
            }

            if (!empty($key) && !array_key_exists($key, $_ENV)) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
            }
        }
    }
}
