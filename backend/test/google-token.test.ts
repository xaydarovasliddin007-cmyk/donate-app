import { describe, expect, it, vi, beforeEach } from 'vitest';

const verifyIdTokenMock = vi.fn();

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    verifyIdToken = verifyIdTokenMock;
  }
  return { OAuth2Client: MockOAuth2Client };
});

vi.mock('../src/config/env.js', () => ({
  env: { GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com' },
  isProduction: false,
  isTest: true,
}));

const { verifyGoogleIdToken } = await import('../src/modules/auth/google-token.js');

describe('verifyGoogleIdToken', () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it('returns the verified identity for a valid token', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-1',
        email: 'Player@Example.com',
        email_verified: true,
        name: 'Player One',
        picture: 'https://example.com/avatar.png',
      }),
    });

    const identity = await verifyGoogleIdToken('valid-token');

    expect(identity).toEqual({
      googleId: 'google-user-1',
      email: 'player@example.com',
      emailVerified: true,
      name: 'Player One',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: 'valid-token',
      audience: 'test-client-id.apps.googleusercontent.com',
    });
  });

  it('rejects a token with an invalid signature', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Invalid token signature'));
    await expect(verifyGoogleIdToken('bad-signature')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an expired token', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Token used too late'));
    await expect(verifyGoogleIdToken('expired')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token issued for a different audience', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Wrong recipient'));
    await expect(verifyGoogleIdToken('wrong-audience')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a payload missing an email (never trust partial identity)', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({ sub: 'google-user-2' }) });
    await expect(verifyGoogleIdToken('no-email')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('surfaces an unverified email rather than silently trusting it', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'google-user-3', email: 'unverified@example.com', email_verified: false }),
    });

    const identity = await verifyGoogleIdToken('unverified-email');
    expect(identity.emailVerified).toBe(false);
  });
});
