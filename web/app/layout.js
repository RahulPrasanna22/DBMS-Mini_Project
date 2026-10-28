import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Smart Inventory & Supply Chain Tracker",
  description: "DBMS Level 3 project",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 text-gray-900">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}