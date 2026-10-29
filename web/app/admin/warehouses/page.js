"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "border rounded px-3 py-2 w-full";
const empty = { name: "", city: "", capacity: "" };

export default function AdminWarehousesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/api/warehouses").then(setRows).catch(setError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function startEdit(w) {
    setEditingId(w.warehouse_id);
    setForm({ name: w.name, city: w.city ?? "", capacity: String(w.capacity) });
    setError(null);
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
    setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setMessage("");
    setBusy(true);
    try {
      if (editingId) {
        await api(`/api/warehouses/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
        setMessage("Warehouse updated.");
      } else {
        await api("/api/warehouses", { method: "POST", body: JSON.stringify(form) });
        setMessage("Warehouse added.");
      }
      setEditingId(null);
      setForm(empty);
      load();
    } catch (err) {
      setError(err); // e.g. duplicate name, capacity 0 or negative
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-blue-600 underline text-sm">← Back to admin</Link>

      <section className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">
          {editingId ? `Edit warehouse #${editingId}` : "Add warehouse"}
        </h1>
        <ErrorAlert error={error} />
        {message && (
          <div className="mb-4 rounded border border-green-300 bg-green-100 text-green-800 px-3 py-2 text-sm">
            {message}
          </div>
        )}
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={input} placeholder="Name (e.g. WH-Hyd)" value={form.name} onChange={set("name")} />
          <input className={input} placeholder="City" value={form.city} onChange={set("city")} />
          <input className={input} type="number" placeholder="Capacity (units)" value={form.capacity} onChange={set("capacity")} />
          <div className="md:col-span-3 flex gap-2">
            <button disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
              {busy ? "Saving..." : editingId ? "Save changes" : "Add warehouse"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="border rounded px-4 py-2 hover:bg-gray-100">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-3">Warehouses</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Capacity</th>
              <th className="px-3 py-2">Units stored</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.warehouse_id} className="border-t">
                <td className="px-3 py-2">{w.name}</td>
                <td className="px-3 py-2">{w.city || "-"}</td>
                <td className="px-3 py-2">{w.capacity}</td>
                <td className="px-3 py-2">{w.used}</td>
                <td className="px-3 py-2">
                  <button onClick={() => startEdit(w)} className="text-blue-600 underline">Edit</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No warehouses.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}