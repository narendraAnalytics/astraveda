import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import MinimalHeader from "@/components/MinimalHeader";
import FeatureBackdrop from "@/components/FeatureBackdrop";

// Server-side gate + light page frame shared by every /puja route: signed-out
// visitors go to /sign-in; everyone else gets the bright, airy backdrop.
export default async function PujaShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div data-nav-theme="light" className="min-h-screen">
      <FeatureBackdrop />
      <MinimalHeader />
      <main className={`${wide ? "max-w-[1100px]" : "max-w-[900px]"} mx-auto px-4 sm:px-6 pt-32 pb-28`}>{children}</main>
    </div>
  );
}
