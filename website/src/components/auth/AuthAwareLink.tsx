"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type Props = {
  signedOutHref: string;
  signedInHref: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

export default function AuthAwareLink({
  signedOutHref,
  signedInHref,
  ...rest
}: Props) {
  const { isSignedIn } = useUser();
  // Always match the server's render (signedOutHref) on the client's first
  // paint — Clerk's isSignedIn can resolve to a different value than the
  // server guessed before its own state has loaded, and picking it up
  // synchronously here caused a hydration mismatch on this href. Swapping in
  // the real destination only after mount (via effect) keeps first paint
  // identical to SSR and updates the attribute safely afterwards.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const href = mounted && isSignedIn ? signedInHref : signedOutHref;

  return <a href={href} {...rest} />;
}
