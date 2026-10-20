"use client";

// A password field with a show / hide button (the eye) at its right edge. Put it
// inside a `relative` box; the field keeps room on the right for the button.
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input {...props} type={shown ? "text" : "password"} className={cn(className, "pr-11")} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? tr("Hide password") : tr("Show password")}
        aria-pressed={shown}
        title={shown ? tr("Hide password") : tr("Show password")}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink"
      >
        {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </>
  );
}
