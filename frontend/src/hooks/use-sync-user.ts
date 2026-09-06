import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/expo';

import { api, API_URL } from '../lib/api';
import { i18n } from '../i18n';

export type SyncedUser = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  first_name: string | null;
  username: string | null;
  image_url: string | null;
  language: string;
};

/**
 * Upserts the signed-in Clerk user into the Neon `users` table (via the backend
 * `/auth/sync`) once per sign-in. The webhook is the primary sync path; this is
 * the request-time safety net so a row always exists for an active user.
 */
export function useSyncUser() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || !API_URL) return;
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;

    (async () => {
      try {
        const token = await getToken();
        await api<SyncedUser>('/auth/sync', {
          method: 'POST',
          token,
          body: {
            email: user.primaryEmailAddress?.emailAddress ?? null,
            first_name: user.firstName ?? null,
            last_name: user.lastName ?? null,
            username: user.username ?? null,
            image_url: user.imageUrl ?? null,
            language: i18n.language,
          },
        });
      } catch {
        // Non-fatal: the webhook or a later request will still sync the user.
        syncedFor.current = null;
      }
    })();
  }, [isSignedIn, user, getToken]);
}
