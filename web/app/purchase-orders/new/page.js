"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "w-full border rounded px-3 py-2";
const emptyItem = { product_id: "", quantity: "", unit_cost: "" };

function NewPurchaseOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lookups, setLookups] = useState({ suppliers: [], warehouses: [], products: [] });
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/lookups")
      .then((d) => {
        setLookups(d);

        // Prefill when coming from "Create PO" on the alerts page
        const s = searchParams.get("supplier");
        const w = searchParams.get("warehouse");
        const p = searchParams.get("product");
        const q = searchParams.get("qty");
        if (s) setSupplierId(s);
        if (w) setWarehouseId(w);
        if (p) {
          const product = d.products.find((x) => String(x.product_id) === p);
          setItems([
            {
              product_id: p,
              quantity: q || "",
              unit_cost: product ? String(product.unit_price) : "",
            },
          ]);
        }
      })
      .catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only offer products of the chosen supplier
  const supplierProducts = lookups.products.filter(
    (p) => String(p.supplier_id) === supplierId
  );

  function changeSupplier(e) {
    setSupplierId(e.target.value);
    setItems([{ ...emptyItem }]); // old product choices no longer apply
  }

  function updateItem(index, field, value) {
    setItems(
      items.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, [field]: value };
        // Picking a product fills in its list price as the default unit cost
        if (field === "product_id") {
          const product = lookups.products.find((p) => String(p.product_id) === value);
          next.unit_cost = product ? String(product.unit_price) : "";
        }
        return next;
      })
    );
  }

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await api("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          expected_date: expectedDate,
          items,
        }),
      });
      router.push(`/purchase-orders/${created.po_id}`);
    } catch (err) {
      setError(err); // nothing was saved: the transaction rolled back
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">New purchase order</h1>
      <ErrorAlert error={error} />

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className={input} value={supplierId} onChange={changeSupplier}>
            <option value="">Select supplier</option>
            {lookups.suppliers.map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.name}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          <select className={input} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Deliver to warehouse</option>
            {lookups.warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
          <input
            className={input}
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            title="Expected delivery date"
          />
        </div>

        <div className="space-y-2">
          <h2 className="font-medium">Items</h2>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <select
                className={`${input} col-span-6`}
                value={it.product_id}
                onChange={(e) => updateItem(i, "product_id", e.target.value)}
                disabled={!supplierId}
              >
                <option value="">{supplierId ? "Select product" : "Select a supplier first"}</option>
                {supplierProducts.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
              <input
                className={`${input} col-span-2`}
                type="number"
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
              />
              <input
                className={`${input} col-span-3`}
                type="number"
                step="0.01"
                placeholder="Unit cost"
                value={it.unit_cost}
                onChange={(e) => updateItem(i, "unit_cost", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                className="col-span-1 border rounded hover:bg-gray-100 disabled:opacity-30"
                title="Remove item"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-blue-600 underline text-sm">
            + Add item
          </button>
        </div>

        <button
          disabled={saving}
          className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Create purchase order"}
        </button>
      </form>
    </div>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <NewPurchaseOrderForm />
    </Suspense>
  );
}