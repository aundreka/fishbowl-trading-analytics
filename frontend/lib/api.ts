export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fishbowl-token") : null;
  const headers = new Headers(options?.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const rawMessage = await response.text();
    let message = rawMessage || "Request failed.";

    try {
      const parsed = JSON.parse(rawMessage) as { detail?: string; error?: { message?: string } };
      message = parsed.detail || parsed.error?.message || message;
    } catch {
      // Keep raw text when the response body is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
