import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import MinimalHeader from "@/components/MinimalHeader";
import FeatureBackdrop from "@/components/FeatureBackdrop";
import FaceApp from "./face-app";

export default async function FacePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div data-nav-theme="light" className="min-h-screen">
      <FeatureBackdrop />
      <MinimalHeader />
      <main className="max-w-[900px] mx-auto px-4 sm:px-6 pt-32 pb-24">
        <FaceApp />
      </main>
    </div>
  );
}
