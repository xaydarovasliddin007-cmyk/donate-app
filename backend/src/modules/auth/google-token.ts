import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { ServiceUnavailableError, UnauthorizedError } from '../../lib/errors.js';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

function requireClientId(): string {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new ServiceUnavailableError('Google sign-in is not configured on this server');
  }
  return clientId;
}

let cachedClient: OAuth2Client | null = null;

/**
 * Verifies a Google ID token's signature (against Google's published JWKS,
 * fetched/cached internally by google-auth-library), issuer, audience, and
 * expiry. Never trust client-supplied identity fields (email, name, sub)
 * without going through this first — throws UnauthorizedError on any
 * verification failure, ServiceUnavailableError if no GOOGLE_CLIENT_ID is
 * configured on this server.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = requireClientId();
  cachedClient ??= new OAuth2Client(clientId);

  let ticket;
  try {
    ticket = await cachedClient.verifyIdToken({ idToken, audience: clientId });
  } catch {
    // google-auth-library throws on bad signature, wrong issuer, wrong
    // audience, and expired tokens alike — we don't need to distinguish
    // these to the client, just refuse the credential.
    throw new UnauthorizedError('Invalid Google credential');
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new UnauthorizedError('Invalid Google credential');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name,
    avatarUrl: payload.picture,
  };
}
