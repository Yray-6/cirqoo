"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (pending) return;
        const bounds = ref.current?.getBoundingClientRect();
        if (!bounds) return;
        const inside =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!inside) onClose();
      }}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-black/45"
    >
      <h2 id={titleId} className="text-lg font-black">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button type="button" className={primaryButtonClass} onClick={onConfirm} disabled={pending}>
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
