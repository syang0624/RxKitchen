"use client";

/**
 * Plain-language orientation for a first-time (non-technical) user. Opens
 * automatically on the very first visit, then lives behind the "?" button.
 */
import { useEffect, useSyncExternalStore } from "react";
import {
  CheckCircle2,
  ChefHat,
  Printer,
  Repeat,
  Users,
  X,
} from "lucide-react";

const KEY = "rxkitchen.help.seen.v1";

let seenCache: boolean | null = null;
const listeners = new Set<() => void>();
function readSeen(): boolean {
  if (seenCache === null) {
    if (typeof window === "undefined") return true; // never auto-open on server
    try {
      seenCache = localStorage.getItem(KEY) === "1";
    } catch {
      seenCache = true;
    }
  }
  return seenCache;
}
export function markHelpSeen() {
  seenCache = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // ignore
  }
  for (const l of listeners) l();
}
export function useHelpSeen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readSeen,
    () => true,
  );
}

const POINTS = [
  {
    icon: ChefHat,
    title: "This week's cooking",
    body: "The whole week at a glance: what the kitchen cooks each day for all 150 clients, what supplies it, and what next week will need.",
  },
  {
    icon: Users,
    title: "Client plans",
    body: "Every client's weekly meal schedule, with each safety check — allergens, sodium, carbs, diet — spelled out and re-verified live.",
  },
  {
    icon: Repeat,
    title: "You stay in control",
    body: "Swap any meal (only safe options are ever offered), put a client's week on hold, and ask “Why this meal?” for the full reasoning.",
  },
  {
    icon: CheckCircle2,
    title: "Nothing goes out without you",
    body: "The agents draft; you approve. The weekly menu can only be sent to the kitchen when every safety check passes.",
  },
  {
    icon: Printer,
    title: "Hand-offs are one click",
    body: "Print the kitchen production sheet — cook list, fresh batches, and donation asks — once you've approved the week.",
  },
];

export default function HelpGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-[560px] max-w-[94vw] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#e5e5e0] px-6 py-5">
          <div>
            <p className="text-xs font-semibold text-[#e60023]">
              Welcome to RxKitchen
            </p>
            <h2 id="help-title" className="text-xl font-bold text-black">
              Your week, planned and safety-checked
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-black transition-colors hover:bg-[#e5e5e0]"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-[#211922]">
                <Icon size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-[#211922]">{title}</p>
                <p className="text-sm leading-relaxed text-[#62625b]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <footer className="border-t border-[#e5e5e0] bg-[#fbfbf9] px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-[#e60023] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#cc001f]"
          >
            Got it — show me the week
          </button>
        </footer>
      </div>
    </div>
  );
}
