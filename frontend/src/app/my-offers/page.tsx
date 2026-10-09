import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MyOffersList } from "@/components/MyOffersList";
import { StatusStrip } from "@/components/StatusStrip";
import { PAGE_CONTAINER } from "@/lib/ui/container";

export default function MyOffersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <StatusStrip />
      <main className={`${PAGE_CONTAINER} flex flex-1 flex-col gap-6 py-16`}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">My offers</h1>
          <p className="text-sm text-muted">
            The offers you&apos;ve made, whether or not someone has taken them yet.
          </p>
        </div>
        <MyOffersList />
      </main>
      <Footer />
    </div>
  );
}
