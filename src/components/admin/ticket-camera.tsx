"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { primaryButtonClass } from "@/components/admin/ui";

const regionId = "ticket-camera";

function cameraMessage(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission/i.test(text)) return "Allow camera access to scan tickets.";
  if (/NotFound|no camera/i.test(text)) return "No camera was found. Type the code instead.";
  return "The camera did not open. Type the code instead.";
}

function readTicketCode(value: string) {
  const match = value.toUpperCase().match(/CRQ-[A-Z0-9]+/);
  return match?.[0] ?? value.trim();
}

export function TicketCamera({ onCode }: { onCode: (code: string) => void }) {
  const onCodeRef = useRef(onCode);
  const [attempt, setAttempt] = useState(0);
  const [cameraState, setCameraState] = useState<"starting" | "live" | "error">("starting");
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    const busy = { current: false };

    async function open() {
      setCameraState("starting");
      setCameraError("");
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const region = document.getElementById(regionId);
      if (!region) return;
      region.replaceChildren();
      scanner = new Html5Qrcode(regionId, { verbose: false });
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        (decoded) => {
          const code = readTicketCode(decoded);
          if (!code || busy.current || !scanner) return;
          busy.current = true;
          try {
            scanner.pause(true);
          } catch {
            // The frame already finished as the camera was stopping.
          }
          onCodeRef.current(code);
          window.setTimeout(() => {
            busy.current = false;
            try {
              scanner?.resume();
            } catch {
              // The page left before the next scan.
            }
          }, 1600);
        },
        () => {},
      );
      if (cancelled) return;
      setCameraState("live");
    }

    open().catch((error: unknown) => {
      if (cancelled) return;
      setCameraState("error");
      setCameraError(cameraMessage(error));
    });

    return () => {
      cancelled = true;
      const current = scanner;
      if (!current) return;
      const finish = current.isScanning ? current.stop() : Promise.resolve();
      finish.then(() => current.clear()).catch(() => {});
    };
  }, [attempt]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-3xl bg-ink">
      <style>{`
        #ticket-camera,
        #ticket-camera > div,
        #ticket-camera video {
          width: 100% !important;
          height: 100% !important;
        }
        #ticket-camera video {
          object-fit: cover !important;
        }
      `}</style>
      <div id={regionId} className="h-full w-full" />
      {cameraState !== "live" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
          <p className="text-sm text-white">
            {cameraState === "starting" ? "Opening camera…" : cameraError}
          </p>
          {cameraState === "error" ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => setAttempt((current) => current + 1)}
            >
              Open camera
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
