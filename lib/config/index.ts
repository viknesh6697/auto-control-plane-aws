export type ControlPlaneMode = "demo" | "live";

export interface LiveAwsConfig {
  region: string;
  tableName: string;
  accountsJson: string;
  hasCredentials: boolean;
  missing: string[];
}

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function falsy(v: string | undefined): boolean {
  if (!v) return false;
  return ["0", "false", "no", "off"].includes(v.toLowerCase());
}

/**
 * Mode selection:
 * - DEMO_MODE=true or CONTROL_PLANE_MODE=demo → demo fixtures
 * - DEMO_MODE=false or CONTROL_PLANE_MODE=live → live AWS adapters
 * - Default (unset): demo, so a fresh clone runs without AWS credentials
 */
export function getControlPlaneMode(): ControlPlaneMode {
  const mode = process.env.CONTROL_PLANE_MODE?.toLowerCase();
  if (mode === "live") return "live";
  if (mode === "demo") return "demo";
  if (falsy(process.env.DEMO_MODE)) return "live";
  if (truthy(process.env.DEMO_MODE)) return "demo";
  return "demo";
}

export function isDemoMode(): boolean {
  return getControlPlaneMode() === "demo";
}

export function getLiveAwsConfig(): LiveAwsConfig {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "";
  const tableName = process.env.CONTROL_PLANE_TABLE || "";
  const accountsJson = process.env.CONTROL_PLANE_ACCOUNTS || "";
  const hasKey =
    Boolean(process.env.AWS_ACCESS_KEY_ID) ||
    Boolean(process.env.AWS_PROFILE) ||
    Boolean(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) ||
    Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE);

  const missing: string[] = [];
  if (!region) missing.push("AWS_REGION");
  if (!tableName) missing.push("CONTROL_PLANE_TABLE");
  if (!accountsJson) missing.push("CONTROL_PLANE_ACCOUNTS");
  // Credentials may come from the default provider chain (instance role, etc.)
  // so we only warn — not hard-fail — when keys are absent.

  return {
    region,
    tableName,
    accountsJson,
    hasCredentials: hasKey,
    missing,
  };
}

export function liveConfigReady(): { ok: true } | { ok: false; missing: string[]; hint: string } {
  const cfg = getLiveAwsConfig();
  if (cfg.missing.length > 0) {
    return {
      ok: false,
      missing: cfg.missing,
      hint: "Set AWS_REGION, CONTROL_PLANE_TABLE, and CONTROL_PLANE_ACCOUNTS (JSON array). Credentials use the standard AWS SDK default chain.",
    };
  }
  return { ok: true };
}

export class ConfigError extends Error {
  readonly missing: string[];
  readonly status = 503;

  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = "ConfigError";
    this.missing = missing;
  }
}
