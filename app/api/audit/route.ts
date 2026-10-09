import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/config";
import { getControlPlane } from "@/lib/control-plane";

export async function GET() {
  const state = await getControlPlane().snapshot();
  return NextResponse.json(state.audit);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "rollback" || !body?.auditId) {
      return NextResponse.json(
        { error: "Expected { action: 'rollback', auditId }" },
        { status: 400 },
      );
    }
    const result = await getControlPlane().rollbackAudit(body.auditId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json(
        { error: e.message, missing: e.missing },
        { status: e.status },
      );
    }
    throw e;
  }
}
