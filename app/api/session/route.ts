import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/config";
import { getControlPlane } from "@/lib/control-plane";
import type { Role } from "@/lib/types";

export async function GET() {
  const state = await getControlPlane().snapshot();
  return NextResponse.json(state.session);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = body?.role as Role;
    if (!["Operator", "Approver", "Admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const result = await getControlPlane().setRole(role);
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
