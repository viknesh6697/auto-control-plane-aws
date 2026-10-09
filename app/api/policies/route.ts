import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/config";
import { getControlPlane } from "@/lib/control-plane";

export async function GET() {
  const state = await getControlPlane().snapshot();
  return NextResponse.json(state.policies);
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await getControlPlane().updatePolicies(body ?? {});
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
