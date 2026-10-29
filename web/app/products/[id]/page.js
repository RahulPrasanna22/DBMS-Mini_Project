"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";
import EditProductForm from "@/components/EditProductForm";

// MongoDB spec fields differ per category, so values are rendered generically
function renderValue(v) {
  if (v === null || v === undefined) return "-";
  if (Array.isArray(v)) return v.map(renderValue).join(", ");
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([k, x]) => `${k}: ${renderValue(x)}`)
      .join(", ");
  }
  return String(v);
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [lookups, setLookups] = useState({ categories: [], suppliers: [] });
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api(`/api/products/${id}`)
      .then((d) => {
        setData(d);
        setError(null);
        setEditing(false);
      })
      .catch(setError);
  }, [id]);

  useEffect(() => {
    load();
    api("/api/auth/me").then(setMe).catch(() => {});
    api("/api/lookups").then(setLookups).catch(() => {});
  }, [load]);

  if (!data) {
    return (
      <div>
        <ErrorAlert error={error} />
        {!error && <p>Loading...</p>}
      </div>
    );
  }

  const { product, stock, specs, specsError } = data;
  const isStaff = me && me.role !== "SUPPLIER";
  const info = [
    ["SKU", product.sku],
    ["Category", product.category],
    ["Supplier", product.supplier],
    ["Unit price", Number(product.unit_price).toFixed(2)],
    ["Reorder level", product.reorder_level],
  ];

  return (
    <div className="space-y-6">
      <Link href="/products" className="text-blue-600 underline text-sm">
        ← Back to products
      </Link>
      <ErrorAlert error={error} />

      {/* Core info: PostgreSQL */}
      <section className="bg-white p-6 rounded shadow">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{product.name}</h1>
            {product.description && <p className="text-gray-600 mt-1">{product.description}</p>}
          </div>
          {isStaff && (
            <button onClick={() => setEditing(!editing)} className="border rounded px-3 py-1 text-sm hover:bg-gray-100">
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {editing && <EditProductForm product={product} lookups={lookups} onSaved={load} />}
      </section>

      {/* Stock per warehouse: PostgreSQL JOIN */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-3">Stock per warehouse</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Warehouse</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.warehouse_id} className="border-t">
                <td className="px-3 py-2">{s.warehouse}</td>
                <td className="px-3 py-2">{s.city}</td>
                <td className="px-3 py-2">{s.quantity}</td>
                <td className="px-3 py-2">{new Date(s.updated_at).toLocaleString()}</td>
              </tr>
            ))}
            {stock.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  No stock recorded in any warehouse.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Specs: MongoDB document */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-3">Specifications (MongoDB)</h2>
        {specsError && (
          <p className="text-amber-700 bg-amber-100 rounded px-3 py-2 text-sm">
            Could not reach MongoDB: {specsError}
          </p>
        )}
        {!specsError && !specs && (
          <p className="text-gray-500 text-sm">No specs document found for this product.</p>
        )}
        {specs?.specs && (
          <table className="w-full text-sm text-left">
            <tbody>
              {Object.entries(specs.specs).map(([key, value]) => (
                <tr key={key} className="border-t">
                  <td className="px-3 py-2 text-gray-500 capitalize w-1/3">{key.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">{renderValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}