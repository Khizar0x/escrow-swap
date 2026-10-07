import Link from "next/link";

// The main navigation. Only Marketplace has a page today. The other two are shown
// as unavailable until their steps are built, so no link leads to an empty page.
export function NavPills() {
  return (
    <nav aria-label="Main" className="w-full overflow-x-auto md:w-auto">
      <ul className="inline-flex items-center gap-1 rounded-full border border-border bg-raised p-1">
        <li>
          <Link
            href="/"
            aria-current="page"
            className="inline-flex whitespace-nowrap rounded-full bg-accent-strong px-4 py-1.5 text-sm font-medium text-on-accent"
          >
            Marketplace
          </Link>
        </li>
        <li>
          <span
            aria-disabled="true"
            className="inline-flex cursor-not-allowed whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-muted"
          >
            Create Offer
          </span>
        </li>
        <li>
          <span
            aria-disabled="true"
            className="inline-flex cursor-not-allowed whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-muted"
          >
            My Offers
          </span>
        </li>
      </ul>
    </nav>
  );
}
