"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const BADGE = {
  ORDERED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};

export default function PurchaseOrdersPage() {
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/auth/me").then(setMe).catch(setError);
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = status ? `?status=${status}` : "";
    api(`/api/purchase-orders${qs}`)
      .then((rows) => {
        setOrders(rows);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [status]);

  const isStaff = me && me.role !== "SUPPLIER";

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Purchase orders</h1>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ORDERED">Ordered</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          {isStaff && (
            <Link
              href="/purchase-orders/new"
              className="bg-slate-800 text-white rounded px-3 py-2 text-sm hover:bg-slate-700"
            >
              + New purchase order
            </Link>
          )}
        </div>
      </div>

      <ErrorAlert error={error} />

      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2">PO #</th>
            <th className="px-3 py-2">Supplier</th>
            <th className="px-3 py-2">Warehouse</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Ordered</th>
            <th className="px-3 py-2">Expected</th>
            <th className="px-3 py-2">Items</th>
            <th className="px-3 py-2">Total value</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.po_id} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/purchase-orders/${o.po_id}`} className="text-blue-600 underline">
                  #{o.po_id}
                </Link>
              </td>
              <td className="px-3 py-2">{o.supplier}</td>
              <td className="px-3 py-2">{o.warehouse}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${BADGE[o.status]}`}>{o.status}</span>
              </td>
              <td className="px-3 py-2">{o.order_date}</td>
              <td className="px-3 py-2">{o.expected_date || "-"}</td>
              <td className="px-3 py-2">{o.item_count}</td>
              <td className="px-3 py-2">{Number(o.total_value).toFixed(2)}</td>
            </tr>
          ))}
          {!loading && orders.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                No purchase orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}