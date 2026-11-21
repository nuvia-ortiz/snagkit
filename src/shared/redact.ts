const SENSITIVE_PARTS = new Set([
  "token", "secret", "password", "passwd", "pwd", "pass", "auth", "authorization", "session", "sessionid",
  "sid", "apikey", "key", "code", "sig", "signature", "jwt", "otp", "nonce", "credential", "credentials",
]);

export const REDACTED = "[redacted]";

/** "access_token", "apiKey" o "session-id" son sensibles; "keyword" o "postcode" no. */
export function isSensitiveParam(name: string): boolean {
  const parts = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_\-.[\]]+/);
  return parts.some((p) => SENSITIVE_PARTS.has(p));
}

/** Oculta los valores de parámetros de URL que suelen llevar credenciales (token, key, session…). */
export function redactUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  let changed = false;
  for (const name of [...url.searchParams.keys()]) {
    if (isSensitiveParam(name)) {
      url.searchParams.set(name, REDACTED);
      changed = true;
    }
  }
  if (url.username || url.password) {
    url.username = "";
    url.password = "";
    changed = true;
  }
  return changed ? url.toString().replaceAll(encodeURIComponent(REDACTED), REDACTED) : raw;
}

/** Recorta textos largos para que el informe siga siendo legible. */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
