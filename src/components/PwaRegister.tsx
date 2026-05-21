import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.info("[pwa] App ready to work offline");
      },
    });
  }, []);
  return null;
}
