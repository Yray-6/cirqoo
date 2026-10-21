"use client";

import { usePathname } from "next/navigation";

export function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-black/10 motion-reduce:animate-none ${className}`} />;
}

function HeadingSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SkeletonBlock className="h-8 w-40 rounded-lg" />
      {action ? <SkeletonBlock className="h-11 w-36 rounded-lg" /> : null}
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonBlock key={index} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}

function FormCard() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-16 rounded-lg" />
        <SkeletonBlock className="h-16 rounded-lg" />
        <SkeletonBlock className="h-28 rounded-lg md:col-span-2" />
        <SkeletonBlock className="h-11 w-36 rounded-lg" />
      </div>
    </div>
  );
}

export function PageSkeleton({ path }: { path?: string | null }) {
  const pathname = usePathname();
  const current = path || pathname;
  const narrow = current === "/admin/profile" || current === "/admin/scan" || current === "/admin/announcements";

  let body = (
    <>
      <HeadingSkeleton action={current === "/admin/events" || current === "/admin/tickets"} />
      <Rows count={4} />
    </>
  );

  if (current === "/admin") {
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock className="h-8 w-40 rounded-lg" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-11 w-28 rounded-lg" />
            <SkeletonBlock className="h-11 w-40 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonBlock className="h-28 rounded-2xl" />
          <SkeletonBlock className="h-28 rounded-2xl lg:col-span-2" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <SkeletonBlock className="h-64 rounded-2xl" />
          <SkeletonBlock className="h-64 rounded-2xl" />
        </div>
      </>
    );
  } else if (current.startsWith("/admin/events/") || current === "/admin/profile" || current === "/admin/scan") {
    body = (
      <>
        <HeadingSkeleton />
        <FormCard />
        <FormCard />
      </>
    );
  } else if (current === "/admin/tickets") {
    body = (
      <>
        <HeadingSkeleton action />
        <SkeletonBlock className="h-16 max-w-md rounded-lg" />
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonBlock className="h-28 rounded-2xl" />
          <SkeletonBlock className="h-28 rounded-2xl" />
        </div>
        <SkeletonBlock className="h-24 rounded-2xl" />
        <Rows count={4} />
      </>
    );
  } else if (
    current === "/admin/discounts" ||
    current === "/admin/staff" ||
    current === "/admin/announcements"
  ) {
    body = (
      <>
        <HeadingSkeleton />
        <FormCard />
        <Rows count={3} />
      </>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${narrow ? "mx-auto max-w-3xl" : ""}`} aria-busy="true">
      <span className="sr-only">Loading</span>
      {body}
    </div>
  );
}
