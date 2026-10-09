import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Marketplace } from "@/components/Marketplace";
import { NetworkWarning } from "@/components/NetworkWarning";
import { StatusStrip } from "@/components/StatusStrip";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <StatusStrip />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pb-16 sm:px-6">
        <Hero />
        <NetworkWarning />
        <Marketplace />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
