import type {
  Action,
  Approval,
  AuditEntry,
  CloudEvent,
  Incident,
  PolicyState,
  Resource,
  Role,
  SessionState,
  StoreSnapshot,
} from "@/lib/types";

/** Shared mutable control-plane store port (demo memory or live DynamoDB-backed). */
export interface ControlPlaneStore {
  snapshot(): StoreSnapshot;
  getVersion(): number;
  reset?(): StoreSnapshot;
  appendAudit(
    entry: Omit<AuditEntry, "id" | "timestamp"> &
      Partial<Pick<AuditEntry, "id" | "timestamp">>,
  ): AuditEntry;
  addEvent(event: CloudEvent): CloudEvent;
  addIncident(incident: Incident): Incident;
  updateIncident(id: string, patch: Partial<Incident>): Incident | null;
  addAction(action: Action): Action;
  updateAction(id: string, patch: Partial<Action>): Action | null;
  addApproval(approval: Approval): Approval;
  updateApproval(id: string, patch: Partial<Approval>): Approval | null;
  getResource(id: string): Resource | undefined;
  updateResourceState(
    id: string,
    statePatch: Record<string, unknown>,
  ): { resource: Resource; before: Record<string, unknown> } | null;
  setResourceState(
    id: string,
    nextState: Record<string, unknown>,
  ): { resource: Resource; before: Record<string, unknown> } | null;
  getPolicies(): PolicyState;
  updatePolicies(patch: Partial<PolicyState>): {
    before: PolicyState;
    after: PolicyState;
  };
  setSession(session: Partial<SessionState>): SessionState;
  setRole(role: Role): SessionState;
  getIncident(id: string): Incident | undefined;
  getAction(id: string): Action | undefined;
  getApproval(id: string): Approval | undefined;
  getAudit(id: string): AuditEntry | undefined;
  markAuditRolledBack(id: string): AuditEntry | null;
  refreshAccountHealth(): void;
  newId(prefix: string): string;
  /** Persist after mutations when the adapter is durable (live). */
  flush?(): Promise<void>;
}
