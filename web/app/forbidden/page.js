import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="max-w-md mx-auto mt-24 bg-white p-6 rounded shadow text-center">
      <h1 className="text-xl font-semibold text-red-700 mb-2">Access denied</h1>
      <p className="mb-4">Your role is not allowed to open this page.</p>
      <Link href="/" className="text-blue-600 underline">Back to home</Link>
    </div>
  );
}