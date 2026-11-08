export class ApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401 && path.startsWith("/api/admin") && !path.endsWith("/login")) {
    window.location.href = "/admin/login";
  }
  if (!response.ok) throw new ApiError(data.error || "Something went wrong.");
  return data as T;
}
