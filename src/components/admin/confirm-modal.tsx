"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel = "Working…",
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const openedAt = useRef(0);
  const userClosed = useRef(false);
  const retries = useRef(0);
  const alive = useRef(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    alive.current = true;
    setMounted(true);
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    retries.current = 0;
    const timer = window.setTimeout(() => {
      if (!dialog.isConnected || dialog.open) return;
      dialog.setAttribute("closedby", "closerequest");
      dialog.showModal();
      openedAt.current = Date.now();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  function requestClose() {
    if (pending) return;
    userClosed.current = true;
    onClose();
  }

  function reopen() {
    const dialog = ref.current;
    if (!dialog || pending || userClosed.current) return;
    if (retries.current >= 2) {
      onClose();
      return;
    }
    retries.current += 1;
    window.setTimeout(() => {
      if (!dialog.isConnected || dialog.open || userClosed.current) return;
      dialog.showModal();
      openedAt.current = Date.now();
    }, 0);
  }

  const dialog = (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (!alive.current || !open || pending || userClosed.current) {
          userClosed.current = false;
          return;
        }
        reopen();
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (pending || Date.now() - openedAt.current < 350) return;
        const bounds = ref.current?.getBoundingClientRect();
        if (!bounds) return;
        const inside =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!inside) requestClose();
      }}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-black/45"
    >
      <h2 id={titleId} className="text-lg font-black">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className={`${secondaryButtonClass} disabled:cursor-wait disabled:opacity-60`}
          onClick={requestClose}
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${primaryButtonClass} disabled:cursor-wait disabled:opacity-60`}
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );

  if (!mounted) return null;
  return createPortal(dialog, document.body);
}
