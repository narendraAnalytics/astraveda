"use client";

import { useSyncUser } from "@/hooks/use-sync-user";

// Mounted once in the root layout so every signed-in page keeps the Neon
// `users` row in sync — mirrors frontend's <AppShell> useSyncUser() call.
export default function AuthSync() {
  useSyncUser();
  return null;
}
