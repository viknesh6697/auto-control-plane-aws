import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function LoadingBlock({ label = "Loading control-plane state…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="size-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not load data</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
    </div>
  );
}
