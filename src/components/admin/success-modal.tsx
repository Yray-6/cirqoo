"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { primaryButtonClass } from "@/components/admin/ui";

type Entry = {
  title: string;
  message: string;
  resolve: () => void;
};

const SuccessContext = createContext<((title: string, message: string) => Promise<void>) | null>(null);

export function SuccessProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Entry | null>(null);
  const currentRef = useRef<Entry | null>(null);

  const close = useCallback(() => {
    currentRef.current?.resolve();
    currentRef.current = null;
    setCurrent(null);
  }, []);

  const showSuccess = useCallback((title: string, message: string) => {
    currentRef.current?.resolve();
    return new Promise<void>((resolve) => {
      const entry = { title, message, resolve };
      currentRef.current = entry;
      setCurrent(entry);
    });
  }, []);

  return (
    <SuccessContext.Provider value={showSuccess}>
      {children}
      <SuccessModal open={current !== null} title={current?.title ?? ""} message={current?.message ?? ""} onClose={close} />
    </SuccessContext.Provider>
  );
}

export function useSuccess() {
  const showSuccess = useContext(SuccessContext);
  if (!showSuccess) throw new Error("Success dialog is missing.");
  return showSuccess;
}

function SuccessModal({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

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
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const bounds = ref.current?.getBoundingClientRect();
        if (!bounds) return;
        const inside =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!inside) onClose();
      }}
      className="m-auto w-[min(100%-2rem,24rem)] rounded-2xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/45"
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(252,100,53,0.12)] text-brand">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M5 12.5 9.2 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id={titleId} className="mt-4 text-lg font-black">
          {title}
        </h2>
        <p id={messageId} className="mt-2 text-sm leading-6 text-muted">
          {message}
        </p>
        <button type="button" className={`${primaryButtonClass} mt-5 min-w-28`} onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
