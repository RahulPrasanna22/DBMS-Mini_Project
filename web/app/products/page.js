"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "supplier", label: "Supplier" },
  { key: "price", label: "Price" },
  { key: "stock", label: "Total stock" },
];

export default function ProductsPage() {
  const [me, setMe] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Who is logged in + category list, loaded once
  useEffect(() => {
    api("/api/auth/me").then(setMe).catch(setError);
    api("/api/lookups").then((d) => setCategories(d.categories)).catch(setError);
  }, []);

  // Reload the table 300 ms after the search box, filter or sort changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (sort) params.set("sort", sort);
      setLoading(true);
      api(`/api/products?${params}`)
        .then((rows) => {
          setProducts(rows);
          setError(null);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, category, sort]);

  const toggleSort = (key) => setSort(sort === key ? `-${key}` : key);
  const arrow = (key) => (sort === key ? " ▲" : sort === `-${key}` ? " ▼" : "");
  const isStaff = me && me.role !== "SUPPLIER";

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Products</h1>
        {isStaff && (
          <Link href="/products/new" className="bg-slate-800 text-white rounded px-3 py-2 text-sm hover:bg-slate-700">
            + Add product
          </Link>
        )}
      </div>

      <ErrorAlert error={error} />

      <div className="flex gap-3 mb-4">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Search products (name, description, SKU)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="px-3 py-2 cursor-pointer select-none hover:bg-gray-200"
              >
                {c.label}
                {arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.product_id} className="border-t">
              <td className="px-3 py-2">{p.sku}</td>
              <td className="px-3 py-2">
                <Link href={`/products/${p.product_id}`} className="text-blue-600 underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-3 py-2">{p.category}</td>
              <td className="px-3 py-2">{p.supplier}</td>
              <td className="px-3 py-2">{Number(p.unit_price).toFixed(2)}</td>
              <td className="px-3 py-2">{p.total_stock}</td>
            </tr>
          ))}
          {!loading && products.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-gray-500">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}