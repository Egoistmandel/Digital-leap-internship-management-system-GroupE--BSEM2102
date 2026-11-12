<?php
/**
 * Input Validation Utility
 * Digital LEAP Internship Management System
 *
 * Provides reusable server-side validation methods.
 * Always validate on the server regardless of frontend validation.
 */

class Validator {
    private array $errors = [];

    /**
     * Validate that a field is not empty.
     */
    public function required(mixed $value, string $field): static {
        if ($value === null || trim((string)$value) === '') {
            $this->errors[$field] = "{$field} is required.";
        }
        return $this;
    }

    /**
     * Validate email format.
     */
    public function email(mixed $value, string $field): static {
        if ($value !== null && trim((string)$value) !== '') {
            if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $this->errors[$field] = "{$field} must be a valid email address.";
            }
        }
        return $this;
    }

    /**
     * Validate minimum string length.
     */
    public function minLength(mixed $value, string $field, int $min): static {
        if ($value !== null && mb_strlen((string)$value) < $min) {
            $this->errors[$field] = "{$field} must be at least {$min} characters.";
        }
        return $this;
    }

    /**
     * Validate maximum string length.
     */
    public function maxLength(mixed $value, string $field, int $max): static {
        if ($value !== null && mb_strlen((string)$value) > $max) {
            $this->errors[$field] = "{$field} must not exceed {$max} characters.";
        }
        return $this;
    }

    /**
     * Validate that a value is in an allowed list.
     */
    public function inList(mixed $value, string $field, array $allowed): static {
        if ($value !== null && !in_array($value, $allowed, true)) {
            $list = implode(', ', $allowed);
            $this->errors[$field] = "{$field} must be one of: {$list}.";
        }
        return $this;
    }

    /**
     * Validate a date string in Y-m-d format.
     */
    public function date(mixed $value, string $field): static {
        if ($value !== null && trim((string)$value) !== '') {
            $d = DateTime::createFromFormat('Y-m-d', $value);
            if (!$d || $d->format('Y-m-d') !== $value) {
                $this->errors[$field] = "{$field} must be a valid date in YYYY-MM-DD format.";
            }
        }
        return $this;
    }

    /**
     * Validate a numeric value within a range.
     */
    public function numeric(mixed $value, string $field, float $min = 0, float $max = PHP_FLOAT_MAX): static {
        if ($value !== null && trim((string)$value) !== '') {
            if (!is_numeric($value) || (float)$value < $min || (float)$value > $max) {
                $this->errors[$field] = "{$field} must be a number between {$min} and {$max}.";
            }
        }
        return $this;
    }

    /**
     * Validate GPS latitude (-90 to 90).
     */
    public function latitude(mixed $value, string $field): static {
        return $this->numeric($value, $field, -90, 90);
    }

    /**
     * Validate GPS longitude (-180 to 180).
     */
    public function longitude(mixed $value, string $field): static {
        return $this->numeric($value, $field, -180, 180);
    }

    /**
     * Check whether validation passed.
     */
    public function passes(): bool {
        return empty($this->errors);
    }

    /**
     * Return all validation errors.
     */
    public function errors(): array {
        return $this->errors;
    }
}
