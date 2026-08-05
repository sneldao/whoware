import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ImmersionShellContextValue {
  fullBleed: boolean;
  setFullBleed: (active: boolean) => void;
}

const ImmersionShellContext = createContext<ImmersionShellContextValue>({
  fullBleed: false,
  setFullBleed: () => undefined,
});

export function ImmersionShellProvider({ children }: { children: ReactNode }) {
  const [fullBleed, setFullBleed] = useState(false);
  const value = useMemo(() => ({ fullBleed, setFullBleed }), [fullBleed]);
  return (
    <ImmersionShellContext.Provider value={value}>
      {children}
    </ImmersionShellContext.Provider>
  );
}

export function useImmersionShell() {
  return useContext(ImmersionShellContext);
}
