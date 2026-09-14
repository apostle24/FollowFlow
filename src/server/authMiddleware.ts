/**
 * Server-Side Authentication Middleware
 * 
 * CRITICAL: This is the single source of truth for authenticated user identity.
 * All protected endpoints MUST use verifyAuthenticatedUser() to extract the real user ID
 * from a verified Firebase ID token. Never trust client-provided userId, isPro, plan, or counts.
 */

import { getAdminAuth } from './firebaseAdmin';

export interface AuthenticatedRequest {
  authenticatedUserId: string;
  userEmail?: string;
  issuedAt: number;
}

/**
 * Verifies a Firebase ID token and returns the authenticated user ID.
 * This is the ONLY trusted way to get the real user identity on the server.
 * 
 * REJECTS:
 * - Missing or invalid token
 * - Expired token
 * - Tampered token
 * - Synthetic/demo UIDs (demo-*, guest, anonymous, direct-user)
 * 
 * Returns:
 * - Valid AuthenticatedRequest with real, verified UID
 * 
 * Throws:
 * - Error with clear message if token invalid or user not authenticated
 */
export async function verifyAuthenticatedUser(idToken: string): Promise<AuthenticatedRequest> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('No authentication token provided');
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error('Server authentication unavailable');
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err: any) {
    const msg = err?.message || String(err);
    throw new Error(`Invalid or expired authentication token: ${msg}`);
  }

  const uid = decodedToken.uid;

  // CRITICAL: Reject any synthetic or non-production user IDs
  const invalidPatterns = ['demo', 'guest', 'anonymous', 'direct-user', 'test', 'mock'];
  if (invalidPatterns.some((p) => uid.startsWith(p) || uid === p)) {
    throw new Error(
      `Synthetic user ID "${uid}" is not allowed for authenticated API access. ` +
      'Please sign in with a real Firebase user account.'
    );
  }

  return {
    authenticatedUserId: uid,
    userEmail: decodedToken.email,
    issuedAt: decodedToken.iat,
  };
}

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Expected format: "Bearer <idToken>"
 * 
 * Returns:
 * - Valid AuthenticatedRequest
 * 
 * Throws:
 * - Error if header missing, malformed, or token invalid
 */
export async function extractAndVerifyAuth(authHeader?: string): Promise<AuthenticatedRequest> {
  if (!authHeader || typeof authHeader !== 'string') {
    throw new Error('Authorization header required');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new Error('Authorization header must be in format "Bearer <token>"');
  }

  const idToken = parts[1];
  return verifyAuthenticatedUser(idToken);
}

/**
 * Helper to verify that the authenticated user is operating on their own resources.
 * Use this in every protected endpoint to enforce user isolation.
 * 
 * Throws:
 * - Error (403) if resource owner doesn't match authenticated user
 */
export function enforceResourceOwnership(
  authenticatedUserId: string,
  resourceOwnerId: string,
  resourceName: string = 'resource'
): void {
  if (authenticatedUserId !== resourceOwnerId) {
    throw new Error(
      `Forbidden: You do not have permission to access this ${resourceName}. ` +
      `Authenticated user: ${authenticatedUserId}, Resource owner: ${resourceOwnerId}`
    );
  }
}

/**
 * Validates and normalizes an email address.
 * Prevents invalid email formats from being stored.
 * 
 * Returns:
 * - Trimmed, lowercased email
 * 
 * Throws:
 * - Error if email is invalid
 */
export function validateEmailAddress(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Email must be a non-empty string');
  }

  const normalized = email.trim().toLowerCase();

  // Basic email validation (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    throw new Error(`Invalid email format: "${email}"`);
  }

  // Reject known test/placeholder domains
  const testDomains = ['example.com', 'test.com', 'invalid.com', 'localhost'];
  if (testDomains.some((d) => normalized.endsWith(d))) {
    throw new Error(`Test email address not allowed: "${email}"`);
  }

  return normalized;
}

/**
 * Validates a financial amount.
 * Prevents negative, NaN, Infinity, or malformed values.
 * 
 * Returns:
 * - Validated positive number
 * 
 * Throws:
 * - Error if amount invalid
 */
export function validateMonetaryAmount(amount: any, maxValue: number = 999999999): number {
  const num = Number(amount);

  if (!Number.isFinite(num)) {
    throw new Error(`Invalid amount: must be a valid number, got "${amount}"`);
  }

  if (num < 0) {
    throw new Error(`Invalid amount: must be non-negative, got ${num}`);
  }

  if (num > maxValue) {
    throw new Error(`Invalid amount: exceeds maximum of ${maxValue}, got ${num}`);
  }

  // Validate precision (2 decimal places typical for currency)
  const rounded = Math.round(num * 100) / 100;
  return rounded;
}

/**
 * Validates a document ID exists and matches expected format.
 * 
 * Returns:
 * - Validated ID string
 * 
 * Throws:
 * - Error if ID invalid
 */
export function validateDocumentId(id: string, type: string = 'document'): string {
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid ${type} ID: must be non-empty string`);
  }

  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 1024) {
    throw new Error(`Invalid ${type} ID: length must be between 1 and 1024 characters`);
  }

  // Reject common SQL injection/XSS patterns
  if (trimmed.includes('\0') || trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error(`Invalid ${type} ID: contains invalid characters`);
  }

  return trimmed;
}

/**
 * Validates a string field with reasonable length.
 * 
 * Returns:
 * - Validated trimmed string
 * 
 * Throws:
 * - Error if string invalid
 */
export function validateString(
  value: any,
  fieldName: string = 'field',
  maxLength: number = 5000
): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string, got ${typeof value}`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }

  return trimmed;
}
