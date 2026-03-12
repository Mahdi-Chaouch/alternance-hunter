const FALLBACK_BASE_URL = "http://127.0.0.1:8000";

export function getBackendConfig() {
  const baseUrl =
    process.env.PIPELINE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    FALLBACK_BASE_URL;
  const token = process.env.PIPELINE_API_TOKEN ?? process.env.API_TOKEN ?? "";

  return { baseUrl, token };
}

export function getAuthHeaders(token: string): HeadersInit {
  if (!token) {
    return {};
  }

  return { "x-api-token": token };
}
