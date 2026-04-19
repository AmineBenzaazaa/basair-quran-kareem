export const DASHBOARD_SESSION_COOKIE = "tafsir_dashboard_session";
export const DASHBOARD_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type DashboardCredentials = {
  enabled: boolean;
  password: string;
  username: string;
};

type SessionPayload = {
  exp: number;
  u: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function getDashboardAuthCredentials(): DashboardCredentials {
  const username = process.env.DASHBOARD_BASIC_AUTH_USER ?? "";
  const password = process.env.DASHBOARD_BASIC_AUTH_PASSWORD ?? "";

  return {
    enabled: Boolean(username && password),
    password,
    username,
  };
}

export function isDashboardAuthEnabled(): boolean {
  return getDashboardAuthCredentials().enabled;
}

export function credentialsAreValid(
  providedUsername: string,
  providedPassword: string
): boolean {
  const credentials = getDashboardAuthCredentials();

  if (!credentials.enabled) {
    return false;
  }

  return (
    timingSafeEqualText(providedUsername, credentials.username) &&
    timingSafeEqualText(providedPassword, credentials.password)
  );
}

export function isSafeRedirectPath(path: FormDataEntryValue | null): string {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return "/";
  }

  if (path === "/login" || path.startsWith("/login?")) {
    return "/";
  }

  return path;
}

export async function createDashboardSession(username: string): Promise<string> {
  const expiresAt =
    Math.floor(Date.now() / 1000) + DASHBOARD_SESSION_MAX_AGE_SECONDS;
  const payload = encodeBase64Url(
    encoder.encode(
      JSON.stringify({
        exp: expiresAt,
        u: username,
      } satisfies SessionPayload)
    )
  );
  const signature = await sign(payload);

  return `${payload}.${signature}`;
}

export async function verifyDashboardSession(
  sessionValue: string | undefined
): Promise<boolean> {
  const credentials = getDashboardAuthCredentials();

  if (!credentials.enabled) {
    return false;
  }

  if (!sessionValue) {
    return false;
  }

  const parts = sessionValue.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [payload, signature] = parts;
  const expectedSignature = await sign(payload);
  if (!timingSafeEqualText(signature, expectedSignature)) {
    return false;
  }

  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(decodeBase64UrlToString(payload)) as SessionPayload;
  } catch {
    return false;
  }

  return (
    parsed.u === credentials.username &&
    Number.isFinite(parsed.exp) &&
    parsed.exp > Math.floor(Date.now() / 1000)
  );
}

async function sign(payload: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC",
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return encodeBase64Url(new Uint8Array(signature));
}

function getSessionSecret(): string {
  return (
    process.env.DASHBOARD_SESSION_SECRET ??
    process.env.DASHBOARD_WRITE_TOKEN ??
    process.env.DASHBOARD_BASIC_AUTH_PASSWORD ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64UrlToString(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return decoder.decode(bytes);
}

function timingSafeEqualText(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}
