"use client";
// components/NavBar.tsx

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/hooks/useWallet";
import { WalletButton } from "@/components/WalletButton";

const NAV_LINKS = [
  { href: "/",         label: "Home" },
  { href: "/elections", label: "Elections" },
  { href: "/admin",    label: "Admin" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-icon">⛓</span>
          ChainVote
        </Link>

        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${pathname === l.href ? "active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="nav-end">
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
