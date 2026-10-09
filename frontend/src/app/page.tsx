import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Marketplace } from "@/components/Marketplace";
import { NetworkWarning } from "@/components/NetworkWarning";
import { StatusStrip } from "@/components/StatusStrip";
import { PAGE_CONTAINER } from "@/lib/ui/container";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <StatusStrip />
      <main className={`${PAGE_CONTAINER} flex flex-1 flex-col gap-16 pb-16`}>
        <Hero />
        <NetworkWarning />
        <Marketplace />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
