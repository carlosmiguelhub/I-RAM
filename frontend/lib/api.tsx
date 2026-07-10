const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest(
  endpoint: string,
  options: ApiOptions = {}
) {
  const savedToken =
    typeof window !== "undefined"
      ? localStorage.getItem("iram_token")
      : null;

  const token = options.token || savedToken;

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");

  const data = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    console.error("API ERROR:", {
      status: response.status,
      endpoint,
      hasToken: !!token,
      tokenPreview: token ? `${token.slice(0, 10)}...` : null,
      data,
    });

    let message =
      typeof data === "string"
        ? data
        : data?.message ||
          `Request failed with status ${response.status}`;

    if (
      typeof data !== "string" &&
      data?.errors &&
      typeof data.errors === "object"
    ) {
      const firstError = Object.values(data.errors)
        .flat()
        .find((error) => typeof error === "string");

      if (typeof firstError === "string") {
        message = firstError;
      }
    }

    throw new Error(message);
  }

  return data;
}