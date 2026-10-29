"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "w-full border rounded px-3 py-2";

export default function NewProductPage() {
  const router = useRouter();
  const [lookups, setLookups] = useState({ categories: [], suppliers: [] });
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category_id: "",
    supplier_id: "",
    unit_price: "",
    reorder_level: "10",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/lookups").then(setLookups).catch(setError);
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await api("/api/products", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push(`/products/${created.product_id}`);
    } catch (err) {
      setError(err); // e.g. duplicate SKU or negative price, straight from PostgreSQL
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Add product</h1>
      <ErrorAlert error={error} />
      {/* No min= on the price field on purpose: the database does the validation */}
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="SKU (e.g. G-002)" value={form.sku} onChange={set("sku")} />
        <input className={input} placeholder="Name" value={form.name} onChange={set("name")} />
        <textarea className={input} placeholder="Description" value={form.description} onChange={set("description")} />
        <select className={input} value={form.category_id} onChange={set("category_id")}>
          <option value="">Select category</option>
          {lookups.categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{c.name}</option>
          ))}
        </select>
        <select className={input} value={form.supplier_id} onChange={set("supplier_id")}>
          <option value="">Select supplier</option>
          {lookups.suppliers.map((s) => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {s.name}{s.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
        <input className={input} type="number" step="0.01" placeholder="Unit price" value={form.unit_price} onChange={set("unit_price")} />
        <input className={input} type="number" placeholder="Reorder level" value={form.reorder_level} onChange={set("reorder_level")} />
        <button disabled={saving} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save product"}
        </button>
      </form>
    </div>
  );
}