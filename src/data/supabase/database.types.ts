import type { SupabaseClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type Database = {
  public: {
    Tables: {
      app_stores: {
        Row: {
          user_id: UUID;
          store: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: UUID;
          store: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: UUID;
          store?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: UUID;
          email: string | null;
          currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: UUID;
          email?: string | null;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          email?: string | null;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: UUID;
          user_id: UUID;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          user_id: UUID;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          user_id?: UUID;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppSupabaseClient = SupabaseClient<Database>;

export function toDatabaseUuid(value: string): UUID {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("Invalid Supabase UUID.");
  }

  return value as UUID;
}
