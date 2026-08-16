let cachedToken = null;
let tokenExpiresAt = 0;
let refreshPromise = null;

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://sdes_auth:3001";
const SERVICE_NAME = process.env.SERVICE_NAME || "case_service";
const SERVICE_SECRET =
  process.env.SERVICE_SECRET || process.env.SERVICE_SECRET_CASE_SERVICE;

/**
 * Retrieves a valid service JWT token.
 * Caches the token in memory and automatically refreshes it before expiration.
 * Deduplicates simultaneous refresh calls.
 */
export async function getServiceToken() {
  // If a manual static token was provided and no secret is configured, fallback to static token for compatibility
  if (!SERVICE_SECRET && process.env.SERVICE_TOKEN) {
    return process.env.SERVICE_TOKEN;
  }

  // Return cached token if valid for at least another 60 seconds
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  // Deduplicate concurrent token refresh requests
  if (refreshPromise) {
    return await refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(
        `${AUTH_SERVICE_URL}/api/v1/auth/get-service-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            service_name: SERVICE_NAME,
            service_secret: SERVICE_SECRET,
          }),
        },
      );

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(
          `Failed to get service token: HTTP ${response.status} ${response.statusText} - ${errBody}`,
        );
      }

      const data = await response.json();
      if (!data.service_token) {
        throw new Error("Service token response missing service_token field");
      }

      cachedToken = data.service_token;
      const expiresInSec = data.expires_in || 3600;
      tokenExpiresAt = Date.now() + expiresInSec * 1000;

      return cachedToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return await refreshPromise;
}
