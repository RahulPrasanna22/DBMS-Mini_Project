"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function StatCard({ label, value }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [min, setMin] = useState("10");
  const [error, setError] = useState(null);

  // Reload 300 ms after the "more than N units" box changes
  useEffect(() => {
    const timer = setTimeout(() => {
      api(`/api/dashboard?min=${encodeURIComponent(min || 0)}`)
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch(setError);
    }, 300);
    return () => clearTimeout(timer);
  }, [min]);

  if (!data) {
    return (
      <div>
        <ErrorAlert error={error} />
        {!error && <p>Loading...</p>}
      </div>
    );
  }

  const { totals } = data;
  const isSupplier = data.scope === "supplier";

  const categoryData = data.stockByCategory.map((c) => ({
    category: c.category,
    value: Number(c.stock_value),
  }));
  const utilData = data.warehouseUtilisation.map((w) => ({
    name: w.name,
    pct: Number(w.utilisation_pct),
  }));

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />
      <h1 className="text-xl font-semibold">
        Dashboard{isSupplier && <span className="text-gray-500 text-base"> (your products only)</span>}
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Products" value={totals.products} />
        <StatCard label="Warehouses" value={totals.warehouses} />
        <StatCard label="Total stock value" value={fmt(totals.stock_value)} />
        <StatCard label="Open alerts" value={totals.open_alerts} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded shadow">
          <h2 className="font-semibold mb-3">Stock value per category</h2>
          {categoryData.length === 0 ? (
            <p className="text-sm text-gray-500">No stock data.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" name="Stock value" fill="#334155" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {!isSupplier && (
          <section className="bg-white p-6 rounded shadow">
            <h2 className="font-semibold mb-3">Warehouse utilisation (%)</h2>
            {utilData.length === 0 ? (
              <p className="text-sm text-gray-500">No warehouses.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="pct" name="Utilisation" fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Warehouse utilisation table (staff only) */}
      {!isSupplier && (
        <section className="bg-white p-6 rounded shadow">
          <h2 className="font-semibold mb-1">Warehouse utilisation</h2>
          <p className="text-sm text-gray-500 mb-3">SUM(quantity) / capacity per warehouse.</p>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Units stored</th>
                <th className="px-3 py-2">Capacity</th>
                <th className="px-3 py-2">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {data.warehouseUtilisation.map((w) => (
                <tr key={w.warehouse_id} className="border-t">
                  <td className="px-3 py-2">{w.name}</td>
                  <td className="px-3 py-2">{w.used}</td>
                  <td className="px-3 py-2">{w.capacity}</td>
                  <td className="px-3 py-2">{w.utilisation_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* GROUP BY ... HAVING */}
      <section className="bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Suppliers with more than N ordered units</h2>
          <label className="text-sm flex items-center gap-2">
            N =
            <input
              type="number"
              min="0"
              className="border rounded px-2 py-1 w-24"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </label>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          GROUP BY supplier with HAVING SUM(quantity) &gt; N. Cancelled orders are not counted.
        </p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Purchase orders</th>
              <th className="px-3 py-2">Ordered units</th>
            </tr>
          </thead>
          <tbody>
            {data.suppliersOverN.map((s) => (
              <tr key={s.supplier_id} className="border-t">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.orders}</td>
                <td className="px-3 py-2">{s.ordered_units}</td>
              </tr>
            ))}
            {data.suppliersOverN.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No supplier has more than {data.minUnits} ordered units. Try a lower N.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* NOT EXISTS subquery */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-1">Products never ordered</h2>
        <p className="text-sm text-gray-500 mb-3">Subquery with NOT EXISTS on po_items.</p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {data.neverOrdered.map((p) => (
              <tr key={p.product_id} className="border-t">
                <td className="px-3 py-2">{p.sku}</td>
                <td className="px-3 py-2">
                  <Link href={`/products/${p.product_id}`} className="text-blue-600 underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.category}</td>
              </tr>
            ))}
            {data.neverOrdered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Every product has been ordered at least once.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ORDER BY ... DESC LIMIT 10 */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-1">Last 10 stock movements</h2>
        <p className="text-sm text-gray-500 mb-3">ORDER BY created_at DESC LIMIT 10.</p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Warehouse</th>
              <th className="px-3 py-2">Change</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {data.recentMovements.map((m) => (
              <tr key={m.movement_id} className="border-t">
                <td className="px-3 py-2">{new Date(m.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{m.sku} - {m.product}</td>
                <td className="px-3 py-2">{m.warehouse}</td>
                <td
                  className={`px-3 py-2 font-medium ${
                    m.change_qty > 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}
                </td>
                <td className="px-3 py-2">{m.movement_type}</td>
                <td className="px-3 py-2">{m.reference_id ?? "-"}</td>
              </tr>
            ))}
            {data.recentMovements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No stock movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}