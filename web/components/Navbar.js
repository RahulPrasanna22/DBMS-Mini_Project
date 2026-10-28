"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ALL = ["ADMIN", "MANAGER", "SUPPLIER"];
const STAFF = ["ADMIN", "MANAGER"];

const MENU = [
  { href: "/dashboard", label: "Dashboard", roles: ALL },
  { href: "/products", label: "Products", roles: ALL },
  { href: "/inventory", label: "Inventory", roles: STAFF },
  { href: "/alerts", label: "Alerts", roles: STAFF },
  { href: "/purchase-orders", label: "Purchase Orders", roles: ALL },
  { href: "/admin", label: "Admin", roles: ["ADMIN"] },
];

export default function Navbar() {
  const [me, setMe] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  // Re-check who is logged in whenever the page changes
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/login");
    router.refresh();
  }

  if (!me) return null;

  return (
    <nav className="bg-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
        <span className="font-semibold">Inventory Tracker</span>
        <div className="flex gap-4 text-sm">
          {MENU.filter((m) => m.roles.includes(me.role)).map((m) => (
            <Link key={m.href} href={m.href} className="hover:underline">
              {m.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>
            {me.username} <span className="bg-slate-600 rounded px-2 py-0.5 text-xs">{me.role}</span>
          </span>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 rounded px-3 py-1">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}