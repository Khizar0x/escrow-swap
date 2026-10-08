"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The main navigation. Marketplace and Create Offer have pages today. My Offers
// is shown as unavailable until its step is built, so no link leads to an empty page.
export function NavPills() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="w-full overflow-x-auto md:w-auto">
      <ul className="inline-flex items-center gap-1 rounded-full border border-border bg-raised p-1">
        <li>
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={`inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
              pathname === "/" ? "bg-accent-strong text-on-accent" : "text-ink hover:bg-raised"
            }`}
          >
            Marketplace
          </Link>
        </li>
        <li>
          <Link
            href="/create-offer"
            aria-current={pathname === "/create-offer" ? "page" : undefined}
            className={`inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
              pathname === "/create-offer"
                ? "bg-accent-strong text-on-accent"
                : "text-ink hover:bg-raised"
            }`}
          >
            Create Offer
          </Link>
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
