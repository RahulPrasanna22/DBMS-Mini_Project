export default function ErrorAlert({ error }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded border border-red-300 bg-red-100 text-red-700 px-3 py-2 text-sm">
      <p className="font-medium">{error.message}</p>
      {error.detail && <p className="mt-1">{error.detail}</p>}
    </div>
  );
}