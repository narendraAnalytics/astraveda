import IntroOverlay from "@/components/IntroOverlay";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeatureCarousel from "@/components/FeatureCarousel";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import VoiceSpotlight from "@/components/VoiceSpotlight";
import TrustStats from "@/components/TrustStats";
import DownloadCTA from "@/components/DownloadCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="flex flex-col flex-1">
      <IntroOverlay />
      <Navbar />
      <Hero />
      <FeatureCarousel />
      <Services />
      <HowItWorks />
      <VoiceSpotlight />
      <TrustStats />
      <DownloadCTA />
      <Footer />
    </main>
  );
}
