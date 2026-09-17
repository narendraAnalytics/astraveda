import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import type { UserOut } from "@/lib/types";

export default async function AccountPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const token = await getToken();

  let me: UserOut | null = null;
  try {
    me = await api<UserOut>("/auth/me", { token });
  } catch {
    // Backend unreachable/misconfigured — still show what Clerk gave us.
    me = null;
  }

  const name =
    clerkUser?.fullName || clerkUser?.firstName || clerkUser?.username || "Seeker";
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? me?.email ?? null;
  const avatar = clerkUser?.imageUrl ?? null;
  const joined = clerkUser?.createdAt
    ? new Date(clerkUser.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div data-nav-theme="dark" className="min-h-screen bg-[#0E0B1E]">
      <Navbar />
      <main className="max-w-[720px] mx-auto px-6 pt-32 pb-24">
        <div className="rounded-[28px] border border-[rgba(244,210,138,.16)] bg-[rgba(255,247,230,.045)] backdrop-blur-2xl p-8 sm:p-10">
          <div className="flex items-center gap-5 mb-8">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="h-16 w-16 rounded-full object-cover border border-[rgba(244,210,138,.3)]"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[rgba(244,210,138,.12)] border border-[rgba(244,210,138,.3)] flex items-center justify-center text-[22px] text-[#F4D28A] font-[family-name:var(--font-display)]">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-[24px] sm:text-[28px] font-medium text-[#FFF7E6]">
                {name}
              </h1>
              {email && (
                <p className="text-[14px] text-[rgba(255,247,230,.62)]">{email}</p>
              )}
              {joined && (
                <p className="text-[12px] text-[rgba(255,247,230,.4)] mt-0.5">
                  Member since {joined}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(244,210,138,.14)] divide-y divide-[rgba(244,210,138,.12)]">
            <Row label="Language" value={me?.language ?? "en"} />
            <Row label="Date of birth" value={me?.date_of_birth ?? "Not set"} />
            <Row label="Time of birth" value={me?.birth_time ?? "Not set"} />
            <Row label="Birthplace" value={me?.birth_place ?? "Not set"} />
          </div>

          {!me && (
            <p className="mt-5 text-[13px] text-[rgba(255,247,230,.45)]">
              Couldn&apos;t reach the AstraVeda backend for your saved details —
              showing your account info only.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-[13.5px] text-[rgba(255,247,230,.62)]">{label}</span>
      <span className="text-[13.5px] font-medium text-[#FFF7E6]">{value}</span>
    </div>
  );
}
