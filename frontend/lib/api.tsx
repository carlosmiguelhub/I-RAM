console.log("CURRENT API URL:", process.env.NEXT_PUBLIC_API_URL);
const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest(
  endpoint: string,
  options: ApiOptions = {}
) {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is missing. Check frontend/.env.local and restart Next.js."
    );
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const savedToken =
    typeof window !== "undefined"
      ? localStorage.getItem("iram_token")
      : null;

  const token = options.token ?? savedToken;

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestUrl = `${API_URL}${normalizedEndpoint}`;

  console.log("API REQUEST:", {
    method: options.method ?? "GET",
    url: requestUrl,
  });

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error("NETWORK ERROR:", {
      url: requestUrl,
      error,
    });

    throw new Error(
      `Cannot connect to the Laravel server at ${API_URL}. Check your network IP, Laravel server, and firewall.`
    );
  }

  const contentType = response.headers.get("content-type");

  const data = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    console.error("API ERROR:", {
      status: response.status,
      endpoint: normalizedEndpoint,
      url: requestUrl,
      hasToken: Boolean(token),
      data,
    });

    let message =
      typeof data === "string"
        ? data
        : data?.message ||
          `Request failed with status ${response.status}.`;

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