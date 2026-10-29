"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "border rounded px-3 py-2 w-full";
const ISSUE_TAGS = [
  "late_delivery",
  "damaged_packaging",
  "short_quantity",
  "wrong_item",
  "quality_issue",
  "missing_documents",
];
const label = (tag) => tag.replace(/_/g, " ");
const emptyFeedback = { po_id: "", rating: "5", issues: [], comment: "" };
const emptyCert = { type: "", number: "", valid_until: "" };

function daysLeft(date) {
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

function certStatus(date) {
  const d = daysLeft(date);
  if (d < 0) return <span className="bg-red-600 text-white rounded px-2 py-0.5 text-xs">Expired</span>;
  if (d <= 30) return <span className="bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs">{d} days left</span>;
  return <span className="bg-green-100 text-green-800 rounded px-2 py-0.5 text-xs">Valid</span>;
}

export default function SupplierDocumentsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState(emptyFeedback);
  const [cert, setCert] = useState(emptyCert);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/api/suppliers/${id}/documents`).then(setData).catch(setError);
  }, [id]);

  useEffect(() => {
    load();
    api("/api/auth/me").then(setMe).catch(() => {});
  }, [load]);

  function toggleIssue(tag) {
    const has = feedback.issues.includes(tag);
    setFeedback({ ...feedback, issues: has ? feedback.issues.filter((t) => t !== tag) : [...feedback.issues, tag] });
  }

  async function submit(url, body, done) {
    setError(null);
    setMessage("");
    setBusy(true);
    try {
      await api(url, { method: "POST", body: JSON.stringify(body) });
      done();
      load();
    } catch (err) {
      setError(err); // shows MongoDB validator / PostgreSQL errors
    } finally {
      setBusy(false);
    }
  }

  function addFeedback(e) {
    e.preventDefault();
    submit(`/api/suppliers/${id}/feedback`, feedback, () => {
      setFeedback(emptyFeedback);
      setMessage("Feedback saved. The supplier's rating in PostgreSQL was updated from the MongoDB average.");
    });
  }

  function addCert(e) {
    e.preventDefault();
    submit(`/api/suppliers/${id}/certifications`, cert, () => {
      setCert(emptyCert);
      setMessage("Certificate added.");
    });
  }

  if (!data) {
    return (
      <div>
        <ErrorAlert error={error} />
        {!error && <p>Loading...</p>}
      </div>
    );
  }

  const { supplier, receivedPOs, documents, scorecard, mongoError } = data;
  const isStaff = me && me.role !== "SUPPLIER";
  const isAdmin = me?.role === "ADMIN";
  const pendingPOs = receivedPOs.filter((p) => !p.has_feedback);

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />
      {message && (
        <div className="rounded border border-green-300 bg-green-100 text-green-800 px-3 py-2 text-sm">{message}</div>
      )}
      {mongoError && (
        <div className="rounded border border-amber-300 bg-amber-100 text-amber-800 px-3 py-2 text-sm">
          MongoDB could not be reached, so documents are not shown: {mongoError}
        </div>
      )}

      {/* PostgreSQL data */}
      <section className="bg-white p-6 rounded shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{supplier.name}</h1>
            <p className="text-sm text-gray-500">
              {supplier.city ?? "-"} · {supplier.email} · {supplier.phone ?? "no phone"}
            </p>
          </div>
          <span className={`rounded px-2 py-0.5 text-xs ${supplier.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
            {supplier.active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div>
            <p className="text-gray-500">Rating (PostgreSQL)</p>
            <p className="font-semibold text-lg">{supplier.rating ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Avg feedback (MongoDB)</p>
            <p className="font-semibold text-lg">{scorecard ? `${scorecard.avg_rating} / 5` : "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Reviews</p>
            <p className="font-semibold text-lg">{scorecard?.reviews ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-500">Issues reported</p>
            <p className="font-semibold text-lg">{scorecard?.issue_count ?? 0}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3 font-mono">
          mongo_doc_id: {supplier.mongo_doc_id ?? "not linked yet"}
        </p>
      </section>

      {/* MongoDB: certificates */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-1">Certificates</h2>
        <p className="text-sm text-gray-500 mb-4">Stored in MongoDB: certificate types differ per supplier.</p>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Valid until</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(documents?.certifications ?? []).map((c, i) => (
              <tr key={`${c.type}-${c.number}-${i}`} className="border-t">
                <td className="px-3 py-2">{c.type}</td>
                <td className="px-3 py-2 font-mono">{c.number}</td>
                <td className="px-3 py-2">{new Date(c.valid_until).toLocaleDateString()}</td>
                <td className="px-3 py-2">{certStatus(c.valid_until)}</td>
              </tr>
            ))}
            {(documents?.certifications ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500">No certificates on file.</td>
              </tr>
            )}
          </tbody>
        </table>

        {isAdmin && !mongoError && (
          <form onSubmit={addCert} className="grid md:grid-cols-4 gap-3 mt-4">
            <input className={input} placeholder="Type (e.g. FSSAI)" value={cert.type}
              onChange={(e) => setCert({ ...cert, type: e.target.value })} />
            <input className={input} placeholder="Certificate number" value={cert.number}
              onChange={(e) => setCert({ ...cert, number: e.target.value })} />
            <input className={input} type="date" value={cert.valid_until}
              onChange={(e) => setCert({ ...cert, valid_until: e.target.value })} />
            <button disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
              Add certificate
            </button>
          </form>
        )}
      </section>

      {/* MongoDB: feedback */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-1">Delivery feedback</h2>
        <p className="text-sm text-gray-500 mb-4">
          Free text and issue tags per received purchase order, stored as a nested array in MongoDB.
        </p>

        {isStaff && !mongoError && (
          <form onSubmit={addFeedback} className="border rounded p-4 mb-6 space-y-3">
            <p className="font-medium">Record feedback for a received PO</p>
            {pendingPOs.length === 0 ? (
              <p className="text-sm text-gray-500">
                No received purchase orders are waiting for feedback. Receive a PO first.
              </p>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3">
                  <select className={input} value={feedback.po_id}
                    onChange={(e) => setFeedback({ ...feedback, po_id: e.target.value })}>
                    <option value="">Choose a purchase order</option>
                    {pendingPOs.map((p) => (
                      <option key={p.po_id} value={p.po_id}>
                        PO #{p.po_id} · received {p.received_date} · {p.warehouse} · ₹{Number(p.total_value).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <select className={input} value={feedback.rating}
                    onChange={(e) => setFeedback({ ...feedback, rating: e.target.value })}>
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>{"★".repeat(r)} ({r})</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {ISSUE_TAGS.map((tag) => (
                    <label key={tag} className="flex items-center gap-1 capitalize">
                      <input type="checkbox" checked={feedback.issues.includes(tag)} onChange={() => toggleIssue(tag)} />
                      {label(tag)}
                    </label>
                  ))}
                </div>
                <textarea className={input} rows={2} placeholder="Comment (optional)" value={feedback.comment}
                  onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })} />
                <button disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
                  Save feedback
                </button>
              </>
            )}
          </form>
        )}

        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">PO</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Issues</th>
              <th className="px-3 py-2">Comment</th>
            </tr>
          </thead>
          <tbody>
            {(documents?.feedback ?? []).map((f, i) => (
              <tr key={`${f.po_id}-${i}`} className="border-t">
                <td className="px-3 py-2">{new Date(f.date).toLocaleDateString()}</td>
                <td className="px-3 py-2">#{f.po_id}</td>
                <td className="px-3 py-2">{"★".repeat(f.rating)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(f.issues ?? []).map((t) => (
                      <span key={t} className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs capitalize">{label(t)}</span>
                    ))}
                    {(f.issues ?? []).length === 0 && <span className="text-gray-400">none</span>}
                  </div>
                </td>
                <td className="px-3 py-2">{f.comment ?? "-"}</td>
              </tr>
            ))}
            {(documents?.feedback ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No feedback yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* MongoDB: contacts */}
      {(documents?.contacts ?? []).length > 0 && (
        <section className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Contacts</h2>
          <ul className="text-sm space-y-1">
            {documents.contacts.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.name}</span>
                {c.role && <span className="text-gray-500"> · {c.role}</span>}
                {c.phone && <span> · {c.phone}</span>}
                {c.email && <span> · {c.email}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
