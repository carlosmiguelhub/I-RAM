const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ApiOptions = RequestInit & {
  token?: string | null;
  acceptedStatuses?: number[];
};

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("iram_token");
  localStorage.removeItem("iram_user");
}

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

  const {
    token: explicitToken,
    acceptedStatuses,
    ...fetchOptions
  } = options;
  const savedToken =
    typeof window !== "undefined"
      ? localStorage.getItem("iram_token")
      : null;

  const token = explicitToken ?? savedToken;

  const headers = new Headers(fetchOptions.headers);

  headers.set("Accept", "application/json");

  if (!(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestUrl = `${API_URL}${normalizedEndpoint}`;

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...fetchOptions,
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

  if (response.status === 401 && token) {
    clearStoredAuth();
  }

  if (
    !response.ok &&
    !acceptedStatuses?.includes(response.status)
  ) {
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

export async function downloadApiFile(
  endpoint: string,
  fallbackFileName: string
): Promise<void> {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is missing. Check frontend/.env.local and restart Next.js."
    );
  }

  const token = localStorage.getItem("iram_token");
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const response = await fetch(`${API_URL}${normalizedEndpoint}`, {
    headers: {
      Accept: "application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    if (response.status === 401 && token) {
      clearStoredAuth();
    }

    throw new Error(
      data?.message || `Download failed with status ${response.status}.`
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
  const fileName = encodedName
    ? decodeURIComponent(encodedName)
    : quotedName || fallbackFileName;
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function previewApiFile(endpoint: string): Promise<void> {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is missing. Check frontend/.env.local and restart Next.js."
    );
  }

  const previewWindow = window.open("", "_blank");

  if (!previewWindow) {
    throw new Error(
      "The preview window was blocked. Allow pop-ups for IRAM and try again."
    );
  }

  previewWindow.opener = null;
  previewWindow.document.title = "Preparing secure preview...";
  previewWindow.document.body.innerHTML =
    '<p style="font:14px system-ui;padding:24px;color:#354139">Preparing secure preview...</p>';

  try {
    const token = localStorage.getItem("iram_token");
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    const response = await fetch(`${API_URL}${normalizedEndpoint}`, {
      headers: {
        Accept: "application/pdf,image/*,application/octet-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      if (response.status === 401 && token) {
        clearStoredAuth();
      }

      throw new Error(
        data?.message || `Preview failed with status ${response.status}.`
      );
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    previewWindow.location.replace(objectUrl);

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
