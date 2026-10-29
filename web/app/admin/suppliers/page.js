"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "border rounded px-3 py-2 w-full";
const empty = { name: "", email: "", phone: "", city: "", rating: "0" };

export default function AdminSuppliersPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/api/suppliers").then(setRows).catch(setError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function startEdit(s) {
    setEditingId(s.supplier_id);
    setForm({
      name: s.name,
      email: s.email,
      phone: s.phone ?? "",
      city: s.city ?? "",
      rating: String(s.rating ?? 0),
    });
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
        await api(`/api/suppliers/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
        setMessage("Supplier updated.");
      } else {
        await api("/api/suppliers", { method: "POST", body: JSON.stringify(form) });
        setMessage("Supplier added.");
      }
      setEditingId(null);
      setForm(empty);
      load();
    } catch (err) {
      setError(err); // e.g. duplicate email, bad email format, rating outside 0-5
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s) {
    setError(null);
    setMessage("");
    try {
      await api(`/api/suppliers/${s.supplier_id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !s.active }),
      });
      setMessage(s.active ? `${s.name} deactivated.` : `${s.name} reactivated.`);
      load();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-blue-600 underline text-sm">← Back to admin</Link>

      <section className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">
          {editingId ? `Edit supplier #${editingId}` : "Add supplier"}
        </h1>
        <ErrorAlert error={error} />
        {message && (
          <div className="mb-4 rounded border border-green-300 bg-green-100 text-green-800 px-3 py-2 text-sm">
            {message}
          </div>
        )}
        {/* type="text" for email and no min/max on rating: the database validates */}
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input className={input} placeholder="Name" value={form.name} onChange={set("name")} />
          <input className={input} placeholder="Email" value={form.email} onChange={set("email")} />
          <input className={input} placeholder="Phone" value={form.phone} onChange={set("phone")} />
          <input className={input} placeholder="City" value={form.city} onChange={set("city")} />
          <input className={input} type="number" step="0.1" placeholder="Rating (0-5)" value={form.rating} onChange={set("rating")} />
          <div className="md:col-span-5 flex gap-2">
            <button disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
              {busy ? "Saving..." : editingId ? "Save changes" : "Add supplier"}
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
        <h2 className="font-semibold mb-3">Suppliers</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Products</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.supplier_id} className="border-t">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.email}</td>
                <td className="px-3 py-2">{s.city || "-"}</td>
                <td className="px-3 py-2">{s.phone || "-"}</td>
                <td className="px-3 py-2">{s.rating}</td>
                <td className="px-3 py-2">{s.product_count}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      s.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => startEdit(s)} className="text-blue-600 underline mr-3">Edit</button>
                  <button onClick={() => toggleActive(s)} className="text-blue-600 underline">
                    {s.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">No suppliers.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}