"use client";

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
  const href = isSignedIn ? signedInHref : signedOutHref;

  return <a href={href} {...rest} />;
}
