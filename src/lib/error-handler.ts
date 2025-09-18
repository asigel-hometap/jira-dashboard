import { NextResponse } from 'next/server';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Standard API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Centralized error handler for API routes
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error);

  // Handle known error types
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code
      },
      { status: error.statusCode }
    );
  }

  // Handle database connection errors
  if (error instanceof Error && error.message.includes('database')) {
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
        code: 'DATABASE_ERROR'
      },
      { status: 503 }
    );
  }

  // Handle Jira API errors
  if (error instanceof Error && error.message.includes('Jira')) {
    return NextResponse.json(
      {
        success: false,
        error: 'Jira API request failed',
        code: 'JIRA_API_ERROR'
      },
      { status: 502 }
    );
  }

  // Handle validation errors
  if (error instanceof Error && error.message.includes('validation')) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR'
      },
      { status: 400 }
    );
  }

  // Handle generic errors
  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  );
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data
  });
}

/**
 * Validation error helper
 */
export function createValidationError(message: string): ApiError {
  return new ApiError(400, message, 'VALIDATION_ERROR');
}

/**
 * Not found error helper
 */
export function createNotFoundError(resource: string): ApiError {
  return new ApiError(404, `${resource} not found`, 'NOT_FOUND');
}

/**
 * Database error helper
 */
export function createDatabaseError(message: string): ApiError {
  return new ApiError(503, `Database error: ${message}`, 'DATABASE_ERROR');
}

/**
 * Jira API error helper
 */
export function createJiraApiError(message: string): ApiError {
  return new ApiError(502, `Jira API error: ${message}`, 'JIRA_API_ERROR');
}
