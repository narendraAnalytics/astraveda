import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import VoiceSpotlight from "@/components/VoiceSpotlight";
import TrustStats from "@/components/TrustStats";
import DownloadCTA from "@/components/DownloadCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="flex flex-col flex-1">
      <Navbar />
      <Hero />
      <Services />
      <HowItWorks />
      <VoiceSpotlight />
      <TrustStats />
      <DownloadCTA />
      <Footer />
    </main>
  );
}
