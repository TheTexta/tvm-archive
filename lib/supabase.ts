import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DVD, Video } from "./catalogue";
import type { ContactMessage } from "./contact";
type AdminVideo = Video & {
  status: "draft" | "published";
  ready: boolean;
  playback_key?: string;
  poster_key?: string;
};
type Database = {
  public: {
    Tables: {
      tvm_contact_messages: {
        Row: ContactMessage;
        Insert: never;
        Update: { reviewed_at?: string | null };
        Relationships: [];
      };
      tvm_videos: {
        Row: AdminVideo;
        Insert: AdminVideo;
        Update: Partial<AdminVideo>;
        Relationships: [];
      };
      tvm_dvds: {
        Row: DVD;
        Insert: DVD;
        Update: Partial<DVD>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      tvm_is_admin: { Args: Record<string, never>; Returns: boolean };
      tvm_submit_contact: {
        Args: {
          p_video_id: string;
          p_name: string;
          p_email: string;
          p_message: string;
        };
        Returns: string;
      };
    };
  };
};
let client: SupabaseClient<Database> | null = null;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient<Database>(url, key);
  return client;
}
