"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  Scale,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { ControlPlaneProvider, useControlPlane } from "@/components/control-plane-provider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { setSessionRole } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/approvals", label: "Approvals", icon: Scale },
  { href: "/policies", label: "Policies", icon: ClipboardList },
  { href: "/audit", label: "Audit", icon: FileSearch },
  { href: "/security", label: "Security", icon: Activity },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, setState } = useControlPlane();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f2f0_0%,_#f4f6f8_45%,_#eef1f4_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 px-3 py-5 backdrop-blur-md">
          <div className="mb-6 px-2">
            <div className="text-[11px] font-semibold tracking-[0.18em] text-teal-800 uppercase">
              AWS Auto
            </div>
            <div className="font-heading text-lg font-semibold tracking-tight text-slate-900">
              Control Plane
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-teal-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="size-4 opacity-80" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 px-1">
            {state?.policies.killSwitch ? (
              <Badge
                variant="outline"
                className="w-full justify-center gap-1 border-red-300 bg-red-50 text-red-700"
              >
                <ShieldOff className="size-3" />
                Kill switch ON
              </Badge>
            ) : null}
            {state?.policies.dryRun ? (
              <Badge
                variant="outline"
                className="w-full justify-center border-violet-300 bg-violet-50 text-violet-800"
              >
                Dry-run mode
              </Badge>
            ) : null}
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide px-1">
              Session role
            </div>
            <Select
              value={state?.session.role ?? "Approver"}
              onValueChange={async (role) => {
                if (!role) return;
                const res = await setSessionRole(role as Role);
                setState(res.state);
              }}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Operator">Operator</SelectItem>
                <SelectItem value="Approver">Approver</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          {state?.configError ? (
            <div className="border-b border-amber-200 bg-amber-50/90 px-6 py-3 md:px-8">
              <Alert>
                <AlertTitle>Live mode needs configuration</AlertTitle>
                <AlertDescription>
                  {state.configError.message}
                  {state.configError.missing.length > 0 ? (
                    <span className="mt-1 block font-mono text-xs">
                      Missing: {state.configError.missing.join(", ")}
                    </span>
                  ) : null}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          <div className="flex-1 px-6 py-5 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ControlPlaneProvider>
      <ShellInner>{children}</ShellInner>
    </ControlPlaneProvider>
  );
}
