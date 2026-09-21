import type { Metadata } from "next";
import PujaApp from "@/components/virtual-puja/PujaApp";

export const metadata: Metadata = {
  title: "Virtual Puja — AstraVeda",
  description:
    "Perform a virtual puja from home: light diyas, ring the temple bell, offer flowers, wave the aarti and blow the shankh — free.",
};

// Public and free — no auth gate, no backend, no payment.
export default function VirtualPujaPage() {
  return <PujaApp />;
}
