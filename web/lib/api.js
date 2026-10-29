// Throws an Error carrying the API's message, so pages can show it in a red alert
export async function api(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.detail = data?.detail || null;
    throw err;
  }
  return data;
}