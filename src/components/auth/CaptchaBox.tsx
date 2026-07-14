import { memo } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

interface CaptchaBoxProps {
  onSuccess: (token: string) => void;
}

export const CaptchaBox = memo(function CaptchaBox({ onSuccess }: CaptchaBoxProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  // Use Cloudflare's always-pass test key only in dev if real key is missing.
  // Never fallback to test key in production (prevents accidental bypass).
  const activeKey = siteKey || (import.meta.env.DEV ? "1x00000000000000000000AA" : "");

  if (!activeKey) {
    console.error("Missing VITE_TURNSTILE_SITE_KEY in production!");
    return (
      <div className="text-sm text-destructive py-2 text-center">Security configuration error.</div>
    );
  }

  return (
    <div className="flex justify-center py-2">
      <Turnstile siteKey={activeKey} onSuccess={onSuccess} />
    </div>
  );
});
