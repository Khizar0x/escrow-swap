"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The main navigation: Marketplace, Create Offer, and My Offers.
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
          <Link
            href="/my-offers"
            aria-current={pathname === "/my-offers" ? "page" : undefined}
            className={`inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
              pathname === "/my-offers" ? "bg-accent-strong text-on-accent" : "text-ink hover:bg-raised"
            }`}
          >
            My Offers
          </Link>
        </li>
      </ul>
    </nav>
  );
}
