import { demoControlPlane } from "@/lib/adapters/demo/control-plane";
import { liveControlPlane } from "@/lib/adapters/live/control-plane";
import { getControlPlaneMode } from "@/lib/config";
import type { ControlPlanePort } from "@/lib/ports/control-plane";

export function getControlPlane(): ControlPlanePort {
  return getControlPlaneMode() === "live" ? liveControlPlane : demoControlPlane;
}

export { getControlPlaneMode, isDemoMode } from "@/lib/config";
export type { ControlPlanePort };
