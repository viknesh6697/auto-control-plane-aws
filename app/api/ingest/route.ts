import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/config";
import { getControlPlane, isDemoMode } from "@/lib/control-plane";

/**
 * Live EventBridge / CloudTrail / Config ingestion endpoint.
 * Accepts raw AWS event envelopes or normalized CloudEvent bodies.
 */
export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json(
      {
        error:
          "Ingest is for live mode. Set DEMO_MODE=false (or CONTROL_PLANE_MODE=live), or use POST /api/demo for the open-SSH demo scenario.",
      },
      { status: 400 },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON event body required" }, { status: 400 });
    }
    const cp = getControlPlane();
    if (!cp.ingestEvent) {
      return NextResponse.json(
        { error: "Ingest not available on this adapter" },
        { status: 500 },
      );
    }
    const result = await cp.ingestEvent(body as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json(
        { error: e.message, missing: e.missing },
        { status: e.status },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
