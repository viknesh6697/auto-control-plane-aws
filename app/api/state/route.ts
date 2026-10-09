import { NextResponse } from "next/server";
import { getControlPlane } from "@/lib/control-plane";
import { ConfigError } from "@/lib/config";

export async function GET() {
  try {
    const cp = getControlPlane();
    return NextResponse.json(await cp.snapshot());
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json(
        { error: e.message, missing: e.missing, mode: "live" },
        { status: e.status },
      );
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cp = getControlPlane();
  if (body?.action === "reset") {
    if (!cp.reset) {
      return NextResponse.json(
        {
          error:
            "Reset is only available when DEMO_MODE=true (or CONTROL_PLANE_MODE=demo)",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(await cp.reset());
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
