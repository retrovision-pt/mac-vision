export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      mac_accounts: {
        Row: {
          id: string
          name: string
          role: string
          username: string
          wallet_id: string
        }
        Insert: {
          id: string
          name: string
          role: string
          username: string
          wallet_id: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          username?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_accounts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mac_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_bootstrap_lock: {
        Row: {
          owner_id: string
          singleton: boolean
        }
        Insert: {
          owner_id: string
          singleton?: boolean
        }
        Update: {
          owner_id?: string
          singleton?: boolean
        }
        Relationships: []
      }
      mac_chat_settings: {
        Row: {
          enabled: boolean
          store_id: string
        }
        Insert: {
          enabled?: boolean
          store_id: string
        }
        Update: {
          enabled?: boolean
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_chat_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "mac_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_documents: {
        Row: {
          key: string
          revision: number
          store_id: string | null
          updated_at: string
          value: Json
          wallet_id: string
        }
        Insert: {
          key: string
          revision?: number
          store_id?: string | null
          updated_at?: string
          value: Json
          wallet_id: string
        }
        Update: {
          key?: string
          revision?: number
          store_id?: string | null
          updated_at?: string
          value?: Json
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mac_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mac_documents_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mac_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_memberships: {
        Row: {
          metadata: Json
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          metadata?: Json
          role: string
          store_id: string
          user_id: string
        }
        Update: {
          metadata?: Json
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mac_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          recipient_id: string | null
          sender_id: string
          store_id: string
          wallet_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          recipient_id?: string | null
          sender_id: string
          store_id: string
          wallet_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          recipient_id?: string | null
          sender_id?: string
          store_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mac_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mac_messages_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mac_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_presence: {
        Row: {
          last_seen: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          last_seen?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_presence_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mac_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mac_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_stores: {
        Row: {
          id: string
          metadata: Json
          name: string
          wallet_id: string
        }
        Insert: {
          id: string
          metadata?: Json
          name: string
          wallet_id: string
        }
        Update: {
          id?: string
          metadata?: Json
          name?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mac_stores_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mac_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mac_wallets: {
        Row: {
          app_name: string
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          app_name: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          app_name?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          preferences: Json
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          preferences?: Json
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          preferences?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mac_delete_document: {
        Args: { k: string; w: string }
        Returns: undefined
      }
      mac_put_document: {
        Args: { k: string; r: number; s: string; v: Json; w: string }
        Returns: number
      }
      mac_reserve_bootstrap: { Args: { u: string }; Returns: undefined }
      mac_save_registry: {
        Args: { a: string; items: Json }
        Returns: undefined
      }
      mac_set_preference: { Args: { k: string; v: Json }; Returns: undefined }
      mac_store_access: { Args: { s: string }; Returns: boolean }
      mac_wallet_access: { Args: { w: string }; Returns: boolean }
      mac_wallet_admin: { Args: { w: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
