import { useCallback, useState } from "react";

/**
 * Toast state shared between the guessing flow and the AppHeader (for
 * wallet / mint / delegation notifications). Centralized here so any
 * sub-flow can `showToast` without owning a duplicated state slot.
 */
export type ToastType = "info" | "warning" | "success" | "error";

export interface UseGameToastReturn {
  visible: boolean;
  message: string;
  type: ToastType;
  show: (message: string, type?: ToastType) => void;
  dismiss: () => void;
}

export function useGameToast(initialMessage = ""): UseGameToastReturn {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [type, setType] = useState<ToastType>("info");

  const show = useCallback((next: string, nextType: ToastType = "info") => {
    setMessage(next);
    setType(nextType);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, message, type, show, dismiss };
}
