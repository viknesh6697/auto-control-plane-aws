import type {
  Approval,
  DemoRunResult,
  Role,
  StoreSnapshot,
} from "@/lib/types";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchState(): Promise<StoreSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    return await parse(
      await fetch("/api/state", { cache: "no-store", signal: controller.signal }),
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function resetState(): Promise<StoreSnapshot> {
  return parse(
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    }),
  );
}

export async function runDemo(
  target: "sandbox" | "prod" | "both" = "both",
): Promise<{ result: DemoRunResult; state: StoreSnapshot }> {
  return parse(
    await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    }),
  );
}

export async function updatePolicies(body: Record<string, unknown>): Promise<{
  policies: StoreSnapshot["policies"];
  state: StoreSnapshot;
}> {
  return parse(
    await fetch("/api/policies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function decideApprovalRequest(
  approvalId: string,
  decision: "approved" | "rejected",
  rationale?: string,
): Promise<{ approval: Approval; state: StoreSnapshot }> {
  return parse(
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision, rationale }),
    }),
  );
}

export async function rollbackAuditEntry(
  auditId: string,
): Promise<{ ok: boolean; message: string; state: StoreSnapshot }> {
  return parse(
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rollback", auditId }),
    }),
  );
}

export async function setSessionRole(
  role: Role,
): Promise<{ session: StoreSnapshot["session"]; state: StoreSnapshot }> {
  return parse(
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }),
  );
}
