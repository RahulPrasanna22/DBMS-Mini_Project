"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "w-full border rounded px-3 py-2";

export default function EditProductForm({ product, lookups, onSaved }) {
  const [form, setForm] = useState({
    sku: product.sku,
    name: product.name,
    description: product.description ?? "",
    category_id: String(product.category_id),
    supplier_id: String(product.supplier_id),
    unit_price: String(product.unit_price),
    reorder_level: String(product.reorder_level),
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/api/products/${product.product_id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 mt-4 border-t pt-4">
      <ErrorAlert error={error} />
      <input className={input} value={form.sku} onChange={set("sku")} placeholder="SKU" />
      <input className={input} value={form.name} onChange={set("name")} placeholder="Name" />
      <textarea className={input} value={form.description} onChange={set("description")} placeholder="Description" />
      <select className={input} value={form.category_id} onChange={set("category_id")}>
        {lookups.categories.map((c) => (
          <option key={c.category_id} value={c.category_id}>{c.name}</option>
        ))}
      </select>
      <select className={input} value={form.supplier_id} onChange={set("supplier_id")}>
        {lookups.suppliers.map((s) => (
          <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
        ))}
      </select>
      <input className={input} type="number" step="0.01" value={form.unit_price} onChange={set("unit_price")} placeholder="Unit price" />
      <input className={input} type="number" value={form.reorder_level} onChange={set("reorder_level")} placeholder="Reorder level" />
      <button disabled={saving} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}