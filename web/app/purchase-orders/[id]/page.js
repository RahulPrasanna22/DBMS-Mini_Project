"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const BADGE = {
  ORDERED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api(`/api/purchase-orders/${id}`).then(setData).catch(setError),
    [id]
  );

  useEffect(() => {
    load();
    api("/api/auth/me").then(setMe).catch(() => {});
  }, [load]);

  async function act(action, successText) {
    setError(null);
    setMessage("");
    setBusy(true);
    try {
      await api(`/api/purchase-orders/${id}/${action}`, { method: "POST" });
      setMessage(successText);
    } catch (err) {
      setError(err); // the database's message, e.g. "already received"
    } finally {
      setBusy(false);
      load(); // show the current status either way
    }
  }

  if (!data) {
    return (
      <div>
        <ErrorAlert error={error} />
        {!error && <p>Loading...</p>}
      </div>
    );
  }

  const { po, items } = data;
  const isStaff = me && me.role !== "SUPPLIER";
  const total = items.reduce((sum, it) => sum + Number(it.line_total), 0);

  const info = [
    ["Supplier", po.supplier],
    ["Deliver to", po.warehouse],
    ["Created by", po.created_by || "-"],
    ["Order date", po.order_date],
    ["Expected", po.expected_date || "-"],
    ["Received", po.received_date || "-"],
  ];

  return (
    <div className="space-y-6">
      <Link href="/purchase-orders" className="text-blue-600 underline text-sm">
        ← Back to purchase orders
      </Link>
      <ErrorAlert error={error} />
      {message && (
        <div className="rounded border border-green-300 bg-green-100 text-green-800 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <section className="bg-white p-6 rounded shadow">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold">
            Purchase order #{po.po_id}{" "}
            <span className={`ml-2 rounded px-2 py-0.5 text-xs ${BADGE[po.status]}`}>{po.status}</span>
          </h1>
          {isStaff && po.status === "ORDERED" && (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => act("receive", "Purchase order received and stock updated.")}
                className="bg-green-700 text-white rounded px-3 py-2 text-sm hover:bg-green-800 disabled:opacity-50"
              >
                Receive
              </button>
              <button
                disabled={busy}
                onClick={() => act("cancel", "Purchase order cancelled.")}
                className="border border-red-600 text-red-700 rounded px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Cancel order
              </button>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4 text-sm">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-3">Items</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Unit cost</th>
              <th className="px-3 py-2">Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.product_id} className="border-t">
                <td className="px-3 py-2">{it.sku}</td>
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2">{it.quantity}</td>
                <td className="px-3 py-2">{Number(it.unit_cost).toFixed(2)}</td>
                <td className="px-3 py-2">{Number(it.line_total).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td colSpan={4} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2">{total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}