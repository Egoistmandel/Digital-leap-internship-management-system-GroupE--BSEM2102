<?php
/**
 * API Response Utility
 * Digital LEAP Internship Management System
 *
 * Provides a consistent JSON response format for all API endpoints.
 *
 * Success:  { "success": true,  "message": "...", "data": {...} }
 * Error:    { "success": false, "message": "...", "errors": [...] }
 */

class Response {

    /**
     * Send a successful response.
     *
     * @param mixed  $data    Data payload to return.
     * @param string $message Human-readable success message.
     * @param int    $code    HTTP status code (default 200).
     */
    public static function success(mixed $data = null, string $message = 'Success', int $code = 200): void {
        http_response_code($code);
        $response = [
            'success' => true,
            'message' => $message,
        ];
        if ($data !== null) {
            $response['data'] = $data;
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Send an error response.
     *
     * @param string $message Human-readable error message.
     * @param int    $code    HTTP status code (default 400).
     * @param array  $errors  Optional list of field-level validation errors.
     */
    public static function error(string $message, int $code = 400, array $errors = []): void {
        http_response_code($code);
        $response = [
            'success' => false,
            'message' => $message,
        ];
        if (!empty($errors)) {
            $response['errors'] = $errors;
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Send a 401 Unauthorized response.
     */
    public static function unauthorized(string $message = 'Unauthorized. Please log in.'): void {
        self::error($message, 401);
    }

    /**
     * Send a 403 Forbidden response.
     */
    public static function forbidden(string $message = 'You do not have permission to perform this action.'): void {
        self::error($message, 403);
    }

    /**
     * Send a 404 Not Found response.
     */
    public static function notFound(string $message = 'The requested resource was not found.'): void {
        self::error($message, 404);
    }

    /**
     * Send a 500 Internal Server Error response.
     * Never expose exception details to the client.
     */
    public static function serverError(string $message = 'An unexpected error occurred. Please try again later.'): void {
        self::error($message, 500);
    }
}
