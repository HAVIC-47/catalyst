"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function UserMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      {email && (
        <span className="hidden max-w-[180px] truncate text-xs text-white/45 sm:block" title={email}>
          {email}
        </span>
      )}
      <button
        onClick={signOut}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 transition-colors duration-200 hover:border-neon-rose/40 hover:text-neon-rose disabled:opacity-50"
      >
        {signingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
