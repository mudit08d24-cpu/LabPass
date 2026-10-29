"use client";

// Check-in QR scanner. Uses the browser's own BarcodeDetector where it exists (Chrome on Android),
// otherwise html5-qrcode (iPhone Safari, Firefox, desktop). The typed-code box always works.
// Whatever is read (the printed link `…/check-in?code=XXXX` or a bare code) goes to checkIn() as is:
// B's parseCheckinCode accepts both.

import { useEffect, useId, useRef, useState } from "react";
import { QrCodeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Mode = "idle" | "starting" | "native" | "lib" | "unsupported" | "denied";
type LibScanner = { start: (...a: unknown[]) => Promise<unknown>; stop: () => Promise<unknown>; clear: () => void; isScanning?: boolean };

export function QrScanner({ onCode, expectedHint }: { onCode: (code: string) => void; expectedHint?: string }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [code, setCode] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const lib = useRef<LibScanner | null>(null);
  const done = useRef(false);
  const regionId = `qr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const stopAll = async () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    const l = lib.current;
    lib.current = null;
    if (l) {
      try {
        await l.stop();
        l.clear();
      } catch {
        /* already stopped */
      }
    }
  };

  useEffect(() => () => void stopAll(), []);

  const found = (text: string) => {
    if (done.current) return;
    done.current = true;
    void stopAll();
    setMode("idle");
    onCode(text);
  };

  // html5-qrcode needs its <div> on the page before it starts
  useEffect(() => {
    if (mode !== "lib") return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(regionId, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false }) as unknown as LibScanner;
        lib.current = s;
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 }, (text: string) => found(text), () => {});
      } catch (e) {
        if (cancelled) return;
        await stopAll();
        setMode(/permission|denied|notallowed/i.test(String(e)) ? "denied" : "unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const start = async () => {
    done.current = false;
    if (!navigator.mediaDevices?.getUserMedia) return setMode("unsupported");
    const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD) return setMode("lib");
    setMode("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s;
      setMode("native");
      requestAnimationFrame(async () => {
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        const det = new BD({ formats: ["qr_code"] });
        const tick = async () => {
          if (!video.current || !stream.current || done.current) return;
          try {
            const r = await det.detect(video.current);
            if (r[0]?.rawValue) return found(r[0].rawValue);
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    } catch (e) {
      setMode(/NotAllowed|Permission/i.test(String((e as Error)?.name ?? e)) ? "denied" : "lib");
    }
  };

  const scanning = mode === "native" || mode === "lib" || mode === "starting";

  return (
    <div className="grid gap-3">
      {scanning ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-ink">
          {mode === "lib" ? (
            <div id={regionId} className="aspect-square w-full [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
          ) : (
            <>
              <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-[3px] border-sun" aria-hidden />
            </>
          )}
          <button
            type="button"
            onClick={async () => {
              await stopAll();
              setMode("idle");
            }}
            className="absolute right-2 top-2 grid size-9 place-items-center rounded-full border-2 border-ink bg-paper"
            aria-label="Stop camera"
          >
            <XIcon className="size-4" />
          </button>
          <p className="absolute inset-x-0 bottom-2 text-center text-[12px] font-semibold text-paper" aria-live="polite">
            Point the camera at the QR on the resource
          </p>
        </div>
      ) : (
        <button type="button" onClick={start} className="flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink bg-paper/80 px-4 py-6 font-semibold hover:bg-white">
          <QrCodeIcon className="size-7" /> Scan the QR on the equipment
        </button>
      )}
      {mode === "denied" && <p className="text-[13px] text-mute">Camera access was blocked. Allow it in your browser settings, or type the code printed under the QR.</p>}
      {mode === "unsupported" && <p className="text-[13px] text-mute">This browser can&apos;t open the camera here. Type the code printed under the QR instead.</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onCode(code.trim());
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={expectedHint ?? "8-character code, e.g. 3FA09C1B"} aria-label="Check-in code" className="font-mono uppercase" autoCapitalize="characters" autoComplete="off" />
        <Button type="submit" variant="outline">
          Use code
        </Button>
      </form>
    </div>
  );
}
