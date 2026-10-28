"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe);
  }, []);

  return (
    <div className="bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold">Smart Inventory &amp; Supply Chain Tracker</h1>
      {me && (
        <p className="mt-2">
          Welcome, <b>{me.username}</b> (role: {me.role}).
        </p>
      )}
    </div>
  );
}