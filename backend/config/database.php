<?php
/**
 * Database Configuration
 * Digital LEAP Internship Management System
 * 
 * Uses PDO with prepared statements for all queries.
 * Credentials are loaded from environment variables.
 * Never hardcode credentials in this file.
 */

class Database {
    private string $host;
    private string $db_name;
    private string $username;
    private string $password;
    private string $charset = 'utf8mb4';
    private ?PDO $conn = null;

    public function __construct() {
        $this->host     = getenv('DB_HOST')     ?: 'localhost';
        $this->db_name  = getenv('DB_NAME')     ?: 'digital_leap';
        $this->username = getenv('DB_USER')     ?: 'root';
        $this->password = getenv('DB_PASS')     ?: '';
    }

    public function getConnection(): PDO {
        if ($this->conn !== null) {
            return $this->conn;
        }

        $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset={$this->charset}";

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch (PDOException $e) {
            // Log error without exposing credentials or stack trace to client
            error_log('Database connection failed: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database connection error. Please try again later.'
            ]);
            exit;
        }

        return $this->conn;
    }
}
