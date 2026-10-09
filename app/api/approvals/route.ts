import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/config";
import { getControlPlane } from "@/lib/control-plane";

export async function GET() {
  const state = await getControlPlane().snapshot();
  return NextResponse.json(state.approvals);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { approvalId, decision, rationale } = body ?? {};
    if (!approvalId || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "approvalId and decision (approved|rejected) required" },
        { status: 400 },
      );
    }

    const cp = getControlPlane();
    const state = await cp.snapshot();
    if (state.session.role === "Operator" && decision === "approved") {
      return NextResponse.json(
        { error: "Operator role cannot approve — switch to Approver or Admin" },
        { status: 403 },
      );
    }

    const result = await cp.decideApproval(
      approvalId,
      decision,
      state.session.displayName,
      rationale,
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json(
        { error: e.message, missing: e.missing },
        { status: e.status },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
