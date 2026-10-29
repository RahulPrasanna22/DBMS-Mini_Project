"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/alerts").then(setAlerts).catch(setError);
    api("/api/reorder").then(setSuggestions).catch(setError);
  }, []);

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />

      <section className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-1">Open low-stock alerts</h1>
        <p className="text-sm text-gray-500 mb-4">
          Created automatically by a database trigger when stock falls to the reorder level.
        </p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Warehouse</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Reorder level</th>
              <th className="px-3 py-2">Raised</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.alert_id} className="border-t">
                <td className="px-3 py-2">{a.sku} - {a.product}</td>
                <td className="px-3 py-2">{a.warehouse}</td>
                <td className="px-3 py-2 text-red-700 font-medium">{a.quantity}</td>
                <td className="px-3 py-2">{a.reorder_level}</td>
                <td className="px-3 py-2">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  No open alerts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-1">Reorder suggestions</h2>
        <p className="text-sm text-gray-500 mb-4">From the v_reorder_suggestions view.</p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Warehouse</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Reorder level</th>
              <th className="px-3 py-2">Suggested qty</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={`${s.warehouse_id}-${s.product_id}`} className="border-t">
                <td className="px-3 py-2">{s.sku} - {s.name}</td>
                <td className="px-3 py-2">{s.warehouse}</td>
                <td className="px-3 py-2">{s.quantity}</td>
                <td className="px-3 py-2">{s.reorder_level}</td>
                <td className="px-3 py-2">{s.suggested_order_qty}</td>
                <td className="px-3 py-2">{s.supplier}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/purchase-orders/new?supplier=${s.supplier_id}&warehouse=${s.warehouse_id}&product=${s.product_id}&qty=${s.suggested_order_qty}`}
                    className="bg-slate-800 text-white rounded px-3 py-1 text-xs hover:bg-slate-700"
                  >
                    Create PO
                  </Link>
                </td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Nothing needs reordering.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}