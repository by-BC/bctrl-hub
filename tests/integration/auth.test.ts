import { createClient } from "@supabase/supabase-js";
import { describe, expect, inject, it } from "vitest";

const { url, publishableKey } = inject("supabase");

describe("Supabase Auth (local)", () => {
  it("cadastro público está desativado", async () => {
    const supabase = createClient(url, publishableKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signUp({
      email: `intruso-${Date.now()}@bctrl.test`,
      password: "senha-forte-123",
    });
    expect(data.user).toBeNull();
    expect(error?.code).toBe("signup_disabled");
  });
});
