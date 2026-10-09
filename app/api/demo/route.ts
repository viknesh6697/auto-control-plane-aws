import { NextResponse } from "next/server";
import { getControlPlane, isDemoMode } from "@/lib/control-plane";

export async function POST(req: Request) {
  if (!isDemoMode()) {
    return NextResponse.json(
      {
        error:
          "Scenario runner is available when DEMO_MODE=true (or CONTROL_PLANE_MODE=demo). Use POST /api/ingest for live EventBridge/Config events.",
      },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const target = (body?.target as "sandbox" | "prod" | "both") || "both";
  if (!["sandbox", "prod", "both"].includes(target)) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  const cp = getControlPlane();
  if (!cp.runDemoScenario) {
    return NextResponse.json(
      { error: "Demo scenario runner not available" },
      { status: 400 },
    );
  }
  const { result, state } = await cp.runDemoScenario(target);
  return NextResponse.json({ result, state });
}
