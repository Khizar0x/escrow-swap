import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MyOffersList } from "@/components/MyOffersList";
import { StatusStrip } from "@/components/StatusStrip";

export default function MyOffersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <StatusStrip />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6">
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
