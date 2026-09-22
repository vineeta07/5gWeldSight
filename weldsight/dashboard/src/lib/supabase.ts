import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured =
  !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== "" && supabaseAnonKey !== "";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

export const DEMO_USER = {
  id: "demo-user-001",
  email: "inspector@weldsight.demo",
  full_name: "Demo Inspector",
  role: "INSPECTOR" as const,
};
