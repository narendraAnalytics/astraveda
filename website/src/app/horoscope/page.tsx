import MinimalHeader from "@/components/MinimalHeader";
import HoroscopeApp from "./horoscope-app";

export const metadata = { title: "Daily Horoscope — AstraVeda" };

// Free AND public — signed-in and signed-out visitors can both read it (like
// /virtual-puja). Signing in only adds a nicety: your birth-chart sign opens by default.
export default function HoroscopePage() {
  return (
    <div data-nav-theme="light" className="min-h-screen">
      <MinimalHeader />
      <HoroscopeApp />
    </div>
  );
}
