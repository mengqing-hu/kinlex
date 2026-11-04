export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          client_event_id: string
          event_type: string
          id: number
          language: string
          occurred_at: string
          received_at: string
          target_id: number | null
          target_type: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          client_event_id: string
          event_type: string
          id?: never
          language: string
          occurred_at: string
          received_at?: string
          target_id?: number | null
          target_type?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          client_event_id?: string
          event_type?: string
          id?: never
          language?: string
          occurred_at?: string
          received_at?: string
          target_id?: number | null
          target_type?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      audio: {
        Row: {
          accent: string
          duration_ms: number | null
          id: number
          model: string
          owner_id: number
          owner_type: string
          path: string
          voice: string
        }
        Insert: {
          accent: string
          duration_ms?: number | null
          id?: never
          model: string
          owner_id: number
          owner_type: string
          path: string
          voice: string
        }
        Update: {
          accent?: string
          duration_ms?: number | null
          id?: never
          model?: string
          owner_id?: number
          owner_type?: string
          path?: string
          voice?: string
        }
        Relationships: []
      }
      daily_study_time: {
        Row: {
          active_seconds: number
          date: string
          language: string
          user_id: string
          words_viewed: number
        }
        Insert: {
          active_seconds?: number
          date: string
          language: string
          user_id: string
          words_viewed?: number
        }
        Update: {
          active_seconds?: number
          date?: string
          language?: string
          user_id?: string
          words_viewed?: number
        }
        Relationships: []
      }
      example_links: {
        Row: {
          example_id: number
          sort_order: number
          target_id: number
          target_type: string
        }
        Insert: {
          example_id: number
          sort_order?: number
          target_id: number
          target_type: string
        }
        Update: {
          example_id?: number
          sort_order?: number
          target_id?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "example_links_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "examples"
            referencedColumns: ["id"]
          },
        ]
      }
      example_token_glosses: {
        Row: {
          example_id: number
          gloss: string
          meaning_language: string
          position: number
          source: string
        }
        Insert: {
          example_id: number
          gloss: string
          meaning_language: string
          position: number
          source: string
        }
        Update: {
          example_id?: number
          gloss?: string
          meaning_language?: string
          position?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "example_token_glosses_example_id_position_fkey"
            columns: ["example_id", "position"]
            isOneToOne: false
            referencedRelation: "example_tokens"
            referencedColumns: ["example_id", "position"]
          },
        ]
      }
      example_tokens: {
        Row: {
          end_offset: number
          example_id: number
          lemma: string
          position: number
          start_offset: number
          surface: string
          word_id: number | null
        }
        Insert: {
          end_offset: number
          example_id: number
          lemma: string
          position: number
          start_offset: number
          surface: string
          word_id?: number | null
        }
        Update: {
          end_offset?: number
          example_id?: number
          lemma?: string
          position?: number
          start_offset?: number
          surface?: string
          word_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "example_tokens_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "examples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "example_tokens_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      example_translations: {
        Row: {
          example_id: number
          meaning_language: string
          sentence_meaning: string
        }
        Insert: {
          example_id: number
          meaning_language: string
          sentence_meaning: string
        }
        Update: {
          example_id?: number
          meaning_language?: string
          sentence_meaning?: string
        }
        Relationships: [
          {
            foreignKeyName: "example_translations_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "examples"
            referencedColumns: ["id"]
          },
        ]
      }
      examples: {
        Row: {
          example_sentence: string
          id: number
          language: string
          level: string | null
          model_info: Json | null
          source: string
          status: string
        }
        Insert: {
          example_sentence: string
          id?: never
          language: string
          level?: string | null
          model_info?: Json | null
          source: string
          status?: string
        }
        Update: {
          example_sentence?: string
          id?: never
          language?: string
          level?: string | null
          model_info?: Json | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: number
          message: string
          user_id: string | null
          word_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          message: string
          user_id?: string | null
          word_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          message?: string
          user_id?: string | null
          word_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      morphemes: {
        Row: {
          id: number
          is_separable: boolean | null
          language: string
          morpheme: string
          morpheme_meaning: string
          morpheme_type: string
          slug: string
        }
        Insert: {
          id?: never
          is_separable?: boolean | null
          language: string
          morpheme: string
          morpheme_meaning: string
          morpheme_type: string
          slug: string
        }
        Update: {
          id?: never
          is_separable?: boolean | null
          language?: string
          morpheme?: string
          morpheme_meaning?: string
          morpheme_type?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          native_language: string
          profile_public: boolean
          timezone: string
          ui_language: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          native_language?: string
          profile_public?: boolean
          timezone?: string
          ui_language?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          native_language?: string
          profile_public?: boolean
          timezone?: string
          ui_language?: string
          user_id?: string
        }
        Relationships: []
      }
      senses: {
        Row: {
          id: number
          meaning_language: string
          sort_order: number
          word_id: number
          word_meaning: string
        }
        Insert: {
          id?: never
          meaning_language: string
          sort_order?: number
          word_id: number
          word_meaning: string
        }
        Update: {
          id?: never
          meaning_language?: string
          sort_order?: number
          word_id?: number
          word_meaning?: string
        }
        Relationships: [
          {
            foreignKeyName: "senses_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          icon: string | null
          id: number
          name: string
          slug: string
          type: string
        }
        Insert: {
          icon?: string | null
          id?: never
          name: string
          slug: string
          type: string
        }
        Update: {
          icon?: string | null
          id?: never
          name?: string
          slug?: string
          type?: string
        }
        Relationships: []
      }
      user_language_stats: {
        Row: {
          language: string
          roots_mastered: number
          user_id: string
          words_mastered: number
        }
        Insert: {
          language: string
          roots_mastered?: number
          user_id: string
          words_mastered?: number
        }
        Update: {
          language?: string
          roots_mastered?: number
          user_id?: string
          words_mastered?: number
        }
        Relationships: []
      }
      user_languages: {
        Row: {
          language: string
          level: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          language: string
          level?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          language?: string
          level?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          current_streak: number
          longest_streak: number
          total_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          longest_streak?: number
          total_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          longest_streak?: number
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_word_state: {
        Row: {
          due_at: string | null
          familiarity: number
          favorited: boolean
          know_count: number
          last_reviewed_at: string | null
          last_viewed_at: string | null
          learning_count: number
          status: string
          updated_at: string
          user_id: string
          view_count: number
          word_id: number
        }
        Insert: {
          due_at?: string | null
          familiarity?: number
          favorited?: boolean
          know_count?: number
          last_reviewed_at?: string | null
          last_viewed_at?: string | null
          learning_count?: number
          status?: string
          updated_at?: string
          user_id: string
          view_count?: number
          word_id: number
        }
        Update: {
          due_at?: string | null
          familiarity?: number
          favorited?: boolean
          know_count?: number
          last_reviewed_at?: string | null
          last_viewed_at?: string | null
          learning_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          view_count?: number
          word_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_word_state_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_embeddings: {
        Row: {
          embedding: string | null
          model: string
          word_id: number
        }
        Insert: {
          embedding?: string | null
          model: string
          word_id: number
        }
        Update: {
          embedding?: string | null
          model?: string
          word_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "word_embeddings_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_morphemes: {
        Row: {
          morpheme_id: number | null
          position: number
          word_id: number
          word_part: string
        }
        Insert: {
          morpheme_id?: number | null
          position: number
          word_id: number
          word_part: string
        }
        Update: {
          morpheme_id?: number | null
          position?: number
          word_id?: number
          word_part?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_morphemes_morpheme_id_fkey"
            columns: ["morpheme_id"]
            isOneToOne: false
            referencedRelation: "morphemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "word_morphemes_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_slug_redirects: {
        Row: {
          language: string
          old_slug: string
          word_id: number
        }
        Insert: {
          language: string
          old_slug: string
          word_id: number
        }
        Update: {
          language?: string
          old_slug?: string
          word_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "word_slug_redirects_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_tags: {
        Row: {
          tag_id: number
          word_id: number
        }
        Insert: {
          tag_id: number
          word_id: number
        }
        Update: {
          tag_id?: number
          word_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "word_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "word_tags_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          created_at: string
          freq_rank: number | null
          gender: string | null
          id: number
          language: string
          level: string | null
          level_source: string | null
          model_info: Json | null
          plural: string | null
          slug: string
          source: string
          status: string
          updated_at: string
          word: string
          word_class: string
          word_class_detail: string | null
        }
        Insert: {
          created_at?: string
          freq_rank?: number | null
          gender?: string | null
          id?: never
          language: string
          level?: string | null
          level_source?: string | null
          model_info?: Json | null
          plural?: string | null
          slug: string
          source: string
          status?: string
          updated_at?: string
          word: string
          word_class: string
          word_class_detail?: string | null
        }
        Update: {
          created_at?: string
          freq_rank?: number | null
          gender?: string | null
          id?: never
          language?: string
          level?: string | null
          level_source?: string | null
          model_info?: Json | null
          plural?: string | null
          slug?: string
          source?: string
          status?: string
          updated_at?: string
          word?: string
          word_class?: string
          word_class_detail?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_current_user: { Args: never; Returns: undefined }
      flashcard_deck: {
        Args: {
          p_language: string
          p_levels?: string[]
          p_limit?: number
          p_source?: string
        }
        Returns: number[]
      }
      list_word_ids: {
        Args: {
          p_descending: boolean
          p_language: string
          p_level?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort: string
          p_word_class_patterns?: string[]
          p_word_ids?: number[]
        }
        Returns: number[]
      }
      record_flashcard_review: {
        Args: { p_result: string; p_word_id: number }
        Returns: {
          due_at: string | null
          familiarity: number
          favorited: boolean
          know_count: number
          last_reviewed_at: string | null
          last_viewed_at: string | null
          learning_count: number
          status: string
          updated_at: string
          user_id: string
          view_count: number
          word_id: number
        }
        SetofOptions: {
          from: "*"
          to: "user_word_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_user_stats: {
        Args: { p_today: string; p_user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
          total_days: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_stats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_words_fuzzy: {
        Args: { p_language: string; p_limit?: number; p_query: string }
        Returns: {
          created_at: string
          freq_rank: number | null
          gender: string | null
          id: number
          language: string
          level: string | null
          level_source: string | null
          model_info: Json | null
          plural: string | null
          slug: string
          source: string
          status: string
          updated_at: string
          word: string
          word_class: string
          word_class_detail: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "words"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_daily_study_time: {
        Args: {
          p_active_seconds?: number
          p_date: string
          p_language: string
          p_user_id: string
          p_words_viewed?: number
        }
        Returns: {
          active_seconds: number
          date: string
          language: string
          user_id: string
          words_viewed: number
        }
        SetofOptions: {
          from: "*"
          to: "daily_study_time"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      word_class_options: { Args: { p_language: string }; Returns: string[] }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

