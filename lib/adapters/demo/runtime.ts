import { store } from "@/lib/adapters/demo/store";
import type {
  ActionRuntime,
  ActionRuntimeResult,
  DeactivateKeyParams,
  RevokeSgParams,
} from "@/lib/domain/executor";

type InboundRule = {
  protocol: string;
  fromPort: number;
  toPort: number;
  cidr: string;
  description?: string;
};

function rulesEqual(a: InboundRule, b: Partial<InboundRule>) {
  return (
    a.protocol === (b.protocol ?? "tcp") &&
    a.fromPort === Number(b.fromPort) &&
    a.toPort === Number(b.toPort) &&
    a.cidr === b.cidr
  );
}

export const demoActionRuntime: ActionRuntime = {
  async revokeSgRule(
    params: RevokeSgParams,
    dryRun: boolean,
  ): Promise<ActionRuntimeResult> {
    const resource = store.getResource(params.resourceId);
    if (!resource) {
      throw new Error(`Resource ${params.resourceId} not found`);
    }
    const beforeState = structuredClone(resource.state);
    const inbound = (beforeState.inboundRules as InboundRule[]) ?? [];
    const target = {
      protocol: params.protocol,
      fromPort: params.fromPort,
      toPort: params.toPort,
      cidr: params.cidr,
    };
    const nextRules = inbound.filter((r) => !rulesEqual(r, target));
    const afterState = { ...beforeState, inboundRules: nextRules };

    if (!dryRun) {
      store.setResourceState(params.resourceId, afterState);
    }

    const verified = nextRules.every((r) => !rulesEqual(r, target));
    return {
      beforeState,
      afterState,
      verified: dryRun ? true : verified,
      message: dryRun
        ? "Dry-run: would remove matching ingress rule; resource unchanged"
        : verified
          ? `Verified: no inbound rule matches tcp/${params.fromPort} from ${params.cidr}`
          : "Verification failed: offending rule still present",
      rollbackSnapshot: dryRun
        ? undefined
        : { resourceId: params.resourceId, state: beforeState },
    };
  },

  async deactivateAccessKey(
    params: DeactivateKeyParams,
    dryRun: boolean,
  ): Promise<ActionRuntimeResult> {
    const resourceId = params.resourceId || "ak-unused-ci";
    const resource = store.getResource(resourceId);
    if (!resource) {
      throw new Error("Access key resource not found");
    }
    const beforeState = structuredClone(resource.state);
    const afterState = { ...beforeState, status: "Inactive" };
    if (!dryRun) {
      store.setResourceState(resourceId, afterState);
    }
    return {
      beforeState,
      afterState,
      verified: true,
      message: dryRun
        ? "Dry-run: would set key Inactive"
        : "Key status set to Inactive",
      rollbackSnapshot: dryRun
        ? undefined
        : { resourceId, state: beforeState },
    };
  },

  async restoreResource(resourceId, state) {
    store.setResourceState(resourceId, state);
  },
};
