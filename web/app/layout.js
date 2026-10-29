import "./globals.css";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Smart Inventory & Supply Chain Tracker",
  description: "DBMS Level 3 project",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 text-gray-900">
        {/* Suspense lets pages that read the URL (useParams, usePathname) build in Next.js 16 */}
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main className="max-w-6xl mx-auto p-6">
          <Suspense fallback={<p>Loading...</p>}>{children}</Suspense>
        </main>
      </body>
    </html>
  );
}