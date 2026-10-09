import { getLiveAwsConfig } from "@/lib/config";
import type { Account, AccountEnv } from "@/lib/types";

export interface LiveAccountConfig {
  id: string;
  name: string;
  env: AccountEnv;
  awsAccountId: string;
}

export function parseAccounts(): LiveAccountConfig[] {
  const raw = getLiveAwsConfig().accountsJson;
  if (!raw) return [];
  const parsed = JSON.parse(raw) as LiveAccountConfig[];
  if (!Array.isArray(parsed)) {
    throw new Error("CONTROL_PLANE_ACCOUNTS must be a JSON array");
  }
  return parsed;
}

export function toAccountRecords(cfgs: LiveAccountConfig[]): Account[] {
  return cfgs.map((c) => ({
    id: c.id,
    name: c.name,
    env: c.env,
    health: "healthy" as const,
  }));
}
