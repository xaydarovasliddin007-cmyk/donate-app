import { useEffect, useRef } from 'react';
import type { Locale } from '../i18n';

interface GoogleCredentialResponse { credential?: string }
interface GoogleIdentityClient {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: 'popup';
    auto_select: false;
  }) => void;
  renderButton: (parent: HTMLElement, options: {
    type: 'standard'; theme: 'outline'; size: 'large'; text: 'signin_with';
    shape: 'rectangular'; width: number; locale: string;
  }) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityClient } };
  }
}

let scriptPromise: Promise<void> | undefined;
let initializedClientId: string | null = null;
let onGoogleCredential: ((credential: string) => void) | null = null;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity could not be loaded'));
    document.head.append(script);
  }).catch((error: unknown) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

export function GoogleSignInButton({ clientId, locale, onCredential, busy, onUnavailable }: {
  clientId: string; locale: Locale; onCredential: (credential: string) => void;
  busy: boolean; onUnavailable: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const unavailableCallback = useRef(onUnavailable);
  callback.current = onCredential;
  unavailableCallback.current = onUnavailable;

  useEffect(() => {
    let cancelled = false;
    onGoogleCredential = (credential) => callback.current(credential);
    void loadGoogleIdentity().then(() => {
      if (cancelled || !container.current) return;
      const googleId = window.google?.accounts?.id;
      if (!googleId) throw new Error('Google Identity is unavailable');
      if (initializedClientId !== clientId) {
        googleId.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onGoogleCredential?.(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
        });
        initializedClientId = clientId;
      }
      const host = container.current;
      host.replaceChildren();
      googleId.renderButton(host, {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with',
        shape: 'rectangular', width: Math.max(200, Math.min(400, Math.floor(host.clientWidth || 360))),
        locale: locale === 'ru' ? 'ru' : 'uz',
      });
    }).catch(() => {
      if (!cancelled) unavailableCallback.current();
    });
    return () => {
      cancelled = true;
      if (container.current) container.current.replaceChildren();
      onGoogleCredential = null;
    };
  }, [clientId, locale]);

  return <div className={`google-sign-in${busy ? ' is-busy' : ''}`} aria-busy={busy}>
    <div ref={container} />
  </div>;
}
