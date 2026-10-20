import type { ReactNode } from "react";

export const fieldClass =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-brand";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-[#e4572c]";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-black/15 bg-white px-4 py-3 text-sm font-bold text-ink hover:bg-line";

export function PageHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black text-ink">{title}</h1>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
      {label}
      <span className="block w-full font-normal">{children}</span>
    </label>
  );
}
