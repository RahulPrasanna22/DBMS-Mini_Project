"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ErrorAlert from "@/components/ErrorAlert";

const input = "border rounded px-3 py-2 w-full";
const empty = { username: "", password: "", role: "MANAGER", supplier_id: "" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/api/users").then(setUsers).catch(setError);
  }, []);

  useEffect(() => {
    load();
    api("/api/suppliers").then(setSuppliers).catch(setError);
  }, [load]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setMessage("");
    setBusy(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          // only a SUPPLIER user is linked to a supplier
          supplier_id: form.role === "SUPPLIER" ? form.supplier_id : "",
        }),
      });
      setMessage(`User "${form.username}" created.`);
      setForm(empty);
      load();
    } catch (err) {
      setError(err); // e.g. duplicate username, or SUPPLIER without a supplier
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-blue-600 underline text-sm">← Back to admin</Link>

      <section className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Create user</h1>
        <ErrorAlert error={error} />
        {message && (
          <div className="mb-4 rounded border border-green-300 bg-green-100 text-green-800 px-3 py-2 text-sm">
            {message}
          </div>
        )}
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className={input} placeholder="Username" value={form.username} onChange={set("username")} autoComplete="off" />
          <input className={input} type="password" placeholder="Password (min 6)" value={form.password} onChange={set("password")} autoComplete="new-password" />
          <select className={input} value={form.role} onChange={set("role")}>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="SUPPLIER">SUPPLIER</option>
          </select>
          {form.role === "SUPPLIER" ? (
            <select className={input} value={form.supplier_id} onChange={set("supplier_id")}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.name}
                  {s.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-500 flex items-center">No supplier link needed</div>
          )}
          <div className="md:col-span-4">
            <button disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700 disabled:opacity-50">
              {busy ? "Creating..." : "Create user"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-3">Users</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-t">
                <td className="px-3 py-2">{u.user_id}</td>
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.supplier || "-"}</td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No users.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}