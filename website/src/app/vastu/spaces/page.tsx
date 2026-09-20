import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import MinimalHeader from "@/components/MinimalHeader";
import FeatureBackdrop from "@/components/FeatureBackdrop";
import SpacesGallery from "./spaces-gallery";

export default async function VastuSpacesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div data-nav-theme="light" className="min-h-screen">
      <FeatureBackdrop />
      <MinimalHeader />
      <main className="max-w-[900px] mx-auto px-4 sm:px-6 pt-32 pb-24">
        <SpacesGallery />
      </main>
    </div>
  );
}
