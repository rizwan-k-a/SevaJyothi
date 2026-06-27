import { useEffect, useState } from "react";

/**
 * Detects when the app runs as an installed PWA (Android/iOS/desktop standalone).
 * Also exposes a coarse "low-end / save-data" hint we use to disable expensive UI.
 */
export function usePWA() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mqlStandalone = window.matchMedia("(display-mode: standalone)");
    const mqlCoarse = window.matchMedia("(pointer: coarse)");
    const iosStandalone = (window.navigator as any).standalone === true;

    const apply = () => {
      setIsStandalone(mqlStandalone.matches || iosStandalone);
      setIsCoarsePointer(mqlCoarse.matches);
    };
    apply();

    const conn = (navigator as any).connection;
    const slow = !!conn && (conn.saveData || /(^|-)2g$/i.test(conn.effectiveType ?? ""));
    setSaveData(slow);

    mqlStandalone.addEventListener?.("change", apply);
    mqlCoarse.addEventListener?.("change", apply);
    return () => {
      mqlStandalone.removeEventListener?.("change", apply);
      mqlCoarse.removeEventListener?.("change", apply);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.pwa = isStandalone ? "standalone" : "browser";
    document.documentElement.dataset.pointer = isCoarsePointer ? "coarse" : "fine";
    if (saveData) document.documentElement.dataset.savedata = "1";
    else delete document.documentElement.dataset.savedata;
  }, [isStandalone, isCoarsePointer, saveData]);

  return { isStandalone, isCoarsePointer, saveData };
}
