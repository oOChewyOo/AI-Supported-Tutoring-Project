"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { accessDestination } from "@/lib/auth";

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || email.length > 320 || password.length > 4096) redirect("/login?error=credentials");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || data.user.is_anonymous) redirect("/login?error=credentials");
  const destination = await accessDestination({ supabase, user: data.user });
  if (!destination) {
    await supabase.auth.signOut({ scope: "local" });
    revalidatePath("/", "layout");
    redirect("/login?error=access");
  }
  // Invalidate visited pages and the shared header before changing accounts.
  revalidatePath("/", "layout");
  redirect(destination);
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    revalidatePath("/", "layout");
    if (error) redirect("/login?error=signout");
  }
  redirect("/login");
}
