'use strict';

/**
 * Operational API error — carries HTTP status and optional field errors.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode  = statusCode;
    this.errors      = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standardised JSON response helpers.
 */
class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
  }

  static created(res, data, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({ success: true, message, pagination, data });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

module.exports = { ApiError, ApiResponse };
