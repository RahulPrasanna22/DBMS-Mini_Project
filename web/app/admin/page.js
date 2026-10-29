import Link from "next/link";

const SECTIONS = [
  { href: "/admin/suppliers", title: "Suppliers", text: "Add, edit and deactivate suppliers" },
  { href: "/admin/warehouses", title: "Warehouses", text: "Add and edit warehouses and capacity" },
  { href: "/admin/users", title: "Users", text: "Create users with a role and password" },
];

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="bg-white p-6 rounded shadow hover:bg-gray-50">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{s.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}