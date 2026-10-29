"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const label = (tag) => tag.replace(/_/g, " ");

function ratingClass(r) {
  if (r >= 4) return "text-green-700";
  if (r >= 3) return "text-amber-700";
  return "text-red-700";
}

function daysBadge(d) {
  if (d < 0) return <span className="bg-red-600 text-white rounded px-2 py-0.5 text-xs">Expired {-d} days ago</span>;
  if (d <= 15) return <span className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs">{d} days left</span>;
  return <span className="bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs">{d} days left</span>;
}

export default function SupplierQualityPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/supplier-quality?days=${days}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(setError);
  }, [days]);

  if (!data) {
    return (
      <div>
        <ErrorAlert error={error} />
        {!error && <p>Loading...</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />

      <section className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-1">Supplier scorecard</h1>
        <p className="text-sm text-gray-500 mb-4">
          MongoDB aggregation on delivery feedback ($unwind, $group, $avg). Worst suppliers first.
        </p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Avg rating</th>
              <th className="px-3 py-2">Reviews</th>
              <th className="px-3 py-2">Issues reported</th>
              <th className="px-3 py-2">Last feedback</th>
            </tr>
          </thead>
          <tbody>
            {data.scorecard.map((s) => (
              <tr key={s.supplier_id} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/suppliers/${s.supplier_id}`} className="text-blue-700 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{s.city ?? "-"}</td>
                <td className={`px-3 py-2 font-semibold ${ratingClass(s.avg_rating)}`}>{s.avg_rating} / 5</td>
                <td className="px-3 py-2">{s.reviews}</td>
                <td className="px-3 py-2">{s.issue_count}</td>
                <td className="px-3 py-2">{new Date(s.last_feedback).toLocaleDateString()}</td>
              </tr>
            ))}
            {data.scorecard.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">No feedback recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>

        {data.withoutDocuments.length > 0 && (
          <p className="text-sm text-gray-500 mt-4">
            No MongoDB document yet for:{" "}
            {data.withoutDocuments.map((s, i) => (
              <span key={s.supplier_id}>
                {i > 0 && ", "}
                <Link href={`/suppliers/${s.supplier_id}`} className="text-blue-700 hover:underline">
                  {s.name}
                </Link>
              </span>
            ))}
            . One is created automatically when you add their first certificate or feedback.
          </p>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-1">Most common delivery issues</h2>
          <p className="text-sm text-gray-500 mb-4">Double $unwind (feedback, then issue tags), counted per tag.</p>
          {data.topIssues.length === 0 ? (
            <p className="text-sm text-gray-500">No issues reported.</p>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topIssues.map((t) => ({ ...t, label: label(t.issue) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="occurrences" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-sm mt-3 space-y-1">
                {data.topIssues.map((t) => (
                  <li key={t.issue}>
                    <span className="font-medium capitalize">{label(t.issue)}</span>: {t.occurrences}{" "}
                    <span className="text-gray-500">({t.supplier_names.join(", ")})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="bg-white p-6 rounded shadow">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h2 className="text-xl font-semibold">Expiring certificates</h2>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {[30, 60, 90, 365].map((d) => (
                <option key={d} value={d}>Next {d} days</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-gray-500 mb-4">$match on valid_until, days left calculated with $dateDiff.</p>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Certificate</th>
                <th className="px-3 py-2">Valid until</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.expiring.map((c) => (
                <tr key={`${c.supplier_id}-${c.type}-${c.number}`} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/suppliers/${c.supplier_id}`} className="text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {c.type} <span className="text-gray-500">{c.number}</span>
                  </td>
                  <td className="px-3 py-2">{new Date(c.valid_until).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{daysBadge(c.days_left)}</td>
                </tr>
              ))}
              {data.expiring.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    Nothing expires in the next {data.days} days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-1">Product spec fields by category</h2>
        <p className="text-sm text-gray-500 mb-4">
          $objectToArray over product_specs: each category stores different fields, which is why specs live in MongoDB.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {data.specFields.map((c) => (
            <div key={c.category} className="border rounded p-4">
              <p className="font-medium mb-2">
                {c.category} <span className="text-gray-500 text-sm">({c.products.length} product{c.products.length === 1 ? "" : "s"})</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {c.spec_fields.map((f) => (
                  <span key={f} className="bg-gray-100 rounded px-2 py-0.5 text-xs font-mono">{f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
