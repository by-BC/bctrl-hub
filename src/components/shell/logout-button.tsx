"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { clearQueryCache } from "@/components/providers/query-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ withLabel = false }: { withLabel?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function handleLogout() {
    startTransition(async () => {
      const { error } = await createClient().auth.signOut();
      if (error) {
        toast.error("Não foi possível sair. Tente de novo.");
        return;
      }
      clearQueryCache(queryClient);
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size={withLabel ? "default" : "icon"}
      className={withLabel ? "min-h-11" : "size-11"}
      onClick={handleLogout}
      disabled={pending}
      aria-label={withLabel ? undefined : "Sair"}
    >
      <LogOut aria-hidden className="size-5" />
      {withLabel && "Sair"}
    </Button>
  );
}
