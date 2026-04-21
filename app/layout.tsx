// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "ChainVote — Decentralised Blockchain Voting",
  description: "Transparent, tamper-proof elections on the blockchain. Powered by Polygon & MetaMask.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⛓️</text></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper">
          <NavBar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
