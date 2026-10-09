import { NextResponse } from "next/server";
import { getControlPlaneMode, getLiveAwsConfig, liveConfigReady } from "@/lib/config";

export async function GET() {
  const mode = getControlPlaneMode();
  if (mode === "demo") {
    return NextResponse.json({ mode, demoScenario: true, ingest: false });
  }
  const ready = liveConfigReady();
  return NextResponse.json({
    mode,
    demoScenario: false,
    ingest: true,
    aws: {
      region: getLiveAwsConfig().region || null,
      table: getLiveAwsConfig().tableName || null,
      ready: ready.ok,
      missing: ready.ok ? [] : ready.missing,
      hint: ready.ok ? null : ready.hint,
    },
  });
}
