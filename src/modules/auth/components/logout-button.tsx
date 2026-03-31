"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  variant?: "secondary" | "ghost";
}

export function LogoutButton({ variant = "secondary" }: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
    setIsLoading(false);
  };

  return (
    <Button variant={variant} size="sm" onClick={handleLogout} disabled={isLoading}>
      {isLoading ? "Signing out..." : "Logout"}
    </Button>
  );
}
