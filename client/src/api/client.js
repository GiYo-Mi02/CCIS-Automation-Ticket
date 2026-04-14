import { supabase } from "../lib/supabase.js";

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
const API_BASE = configuredApiBase || (import.meta.env.DEV ? "http://localhost:4000" : "");

if (!configuredApiBase && !import.meta.env.DEV) {
  console.warn(
    "VITE_API_BASE_URL is not set. Production requests will use same-origin paths."
  );
}

async function getAuthToken() {
  if (!supabase) {
    return null;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

function buildFetchOptions(options = {}) {
  const fetchOptions = { ...options };
  const { body } = fetchOptions;

  if (body && !(body instanceof FormData) && typeof body !== "string") {
    fetchOptions.body = JSON.stringify(body);
  }

  const headers = new Headers(options.headers || {});
  if (
    !(fetchOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  fetchOptions.headers = headers;
  return fetchOptions;
}

async function apiFetch(path, options = {}) {
  const { timeoutMs = 15000, ...requestOptions } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fetchOptions = buildFetchOptions(requestOptions);

  let timeoutId = null;
  const timeoutController =
    typeof AbortController !== "undefined" ? new AbortController() : null;

  if (timeoutController && !fetchOptions.signal) {
    fetchOptions.signal = timeoutController.signal;
  }

  if (timeoutController && Number(timeoutMs) > 0) {
    timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, Number(timeoutMs));
  }

  // Automatically attach the Supabase Bearer token if we have one
  // and the caller hasn't already set an Authorization header
  if (!fetchOptions.headers.has("Authorization")) {
    const token = await getAuthToken();
    if (token) {
      fetchOptions.headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${normalizedPath}`, fetchOptions);
  } catch (err) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (err?.name === "AbortError") {
      const timeoutError = new Error("Request timed out");
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw err;
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (_) {
      // ignore json parse errors on failures
    }
    const error = new Error(errorPayload?.error || "Request failed");
    error.status = response.status;
    if (errorPayload && typeof errorPayload === "object") {
      error.payload = errorPayload;
    }
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse JSON response", err);
    throw new Error("Failed to parse server response");
  }
}

export { apiFetch, API_BASE };
