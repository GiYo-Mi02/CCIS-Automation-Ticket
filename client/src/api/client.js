const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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
  const response = await fetch(
    `${API_BASE}${path}`,
    buildFetchOptions(options)
  );

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

export { apiFetch };
