import { useEffect } from "react";
import { Platform } from "react-native";

export interface ImmersionKeyboardHandlers {
  enabled: boolean;
  onToggleGuess: () => void;
  onCloseSheets: () => void;
  onUnlockNext: () => void;
  onSelectRailIndex: (railIndex: number) => void;
  railCount: number;
  guessPanelOpen: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === "undefined") return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Desktop immersion shortcuts (web only):
 * Esc close sheets · G Name identity · N next memory · 1–9 scene rail
 */
export function useImmersionKeyboard(handlers: ImmersionKeyboardHandlers): void {
  const {
    enabled,
    onToggleGuess,
    onCloseSheets,
    onUnlockNext,
    onSelectRailIndex,
    railCount,
    guessPanelOpen,
  } = handlers;

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled || typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseSheets();
        return;
      }

      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        onToggleGuess();
        return;
      }

      if (event.key === "n" || event.key === "N") {
        if (guessPanelOpen) return;
        event.preventDefault();
        onUnlockNext();
        return;
      }

      if (event.key >= "1" && event.key <= "9") {
        const railIndex = Number(event.key) - 1;
        if (railIndex < railCount) {
          event.preventDefault();
          onSelectRailIndex(railIndex);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    onToggleGuess,
    onCloseSheets,
    onUnlockNext,
    onSelectRailIndex,
    railCount,
    guessPanelOpen,
  ]);
}
