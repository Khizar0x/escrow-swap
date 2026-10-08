import { CreateOfferForm } from "@/components/CreateOfferForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StatusStrip } from "@/components/StatusStrip";

export default function CreateOfferPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <StatusStrip />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create an offer</h1>
          <p className="text-sm text-muted">
            Choose a token to give and a token you want back. Your tokens are held until
            someone takes the offer or you cancel.
          </p>
        </div>
        <CreateOfferForm />
      </main>
      <Footer />
    </div>
  );
}
