"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "border rounded px-3 py-2";

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ warehouses: [], products: [] });
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    product_id: "",
    from_warehouse: "",
    to_warehouse: "",
    quantity: "",
  });
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const qs = filter ? `?warehouse=${filter}` : "";
    api(`/api/inventory${qs}`).then(setRows).catch(setError);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api("/api/lookups").then(setLookups).catch(setError);
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function transfer(e) {
    e.preventDefault();
    setError(null);
    setMessage("");
    setBusy(true);
    try {
      await api("/api/transfers", { method: "POST", body: JSON.stringify(form) });
      setMessage("Transfer completed.");
      setForm({ ...form, quantity: "" });
      load();
    } catch (err) {
      setError(err); // the database's own message (insufficient stock, capacity, ...)
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Transfer stock</h1>
        <ErrorAlert error={error} />
        {message && (
          <div className="mb-4 rounded border border-green-300 bg-green-100 text-green-800 px-3 py-2 text-sm">
            {message}
          </div>
        )}
        <form onSubmit={transfer} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select className={input} value={form.product_id} onChange={set("product_id")}>
            <option value="">Product</option>
            {lookups.products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.sku} - {p.name}
              </option>
            ))}
          </select>
          <select className={input} value={form.from_warehouse} onChange={set("from_warehouse")}>
            <option value="">From warehouse</option>
            {lookups.warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
          <select className={input} value={form.to_warehouse} onChange={set("to_warehouse")}>
            <option value="">To warehouse</option>
            {lookups.warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.name} ({w.city}), capacity {w.capacity}
              </option>
            ))}
          </select>
          <input
            className={input}
            type="number"
            placeholder="Quantity"
            value={form.quantity}
            onChange={set("quantity")}
          />
          <button
            disabled={busy}
            className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Transferring..." : "Transfer"}
          </button>
        </form>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Inventory</h2>
          <select className={input} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All warehouses</option>
            {lookups.warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Warehouse</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Reorder level</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.warehouse_id}-${r.product_id}`} className="border-t">
                <td className="px-3 py-2">
                  {r.warehouse} <span className="text-gray-500">({r.city})</span>
                </td>
                <td className="px-3 py-2">{r.sku}</td>
                <td className="px-3 py-2">{r.product}</td>
                <td className="px-3 py-2">
                  {r.quantity}
                  {r.quantity <= r.reorder_level && (
                    <span className="ml-2 bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs">Low</span>
                  )}
                </td>
                <td className="px-3 py-2">{r.reorder_level}</td>
                <td className="px-3 py-2">{new Date(r.updated_at).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No inventory records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}