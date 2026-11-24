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
      favorites: {
        Row: {
          created_at: string
          genre_ids: number[]
          media_title: string
          media_type: string
          poster_path: string | null
          tmdb_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          genre_ids?: number[]
          media_title: string
          media_type: string
          poster_path?: string | null
          tmdb_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          genre_ids?: number[]
          media_title?: string
          media_type?: string
          poster_path?: string | null
          tmdb_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      person_review_works: {
        Row: {
          media_type: string
          position: number
          review_id: string
          tmdb_id: number
        }
        Insert: {
          media_type: string
          position: number
          review_id: string
          tmdb_id: number
        }
        Update: {
          media_type?: string
          position?: number
          review_id?: string
          tmdb_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_review_works_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "person_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      person_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          person_tmdb_id: number
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          person_tmdb_id: number
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          person_tmdb_id?: number
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          created_at: string
          id: string
          media_title: string
          media_type: string
          playlist_id: string
          position: number
          poster_path: string | null
          tmdb_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          media_title: string
          media_type: string
          playlist_id: string
          position: number
          poster_path?: string | null
          tmdb_id: number
        }
        Update: {
          created_at?: string
          id?: string
          media_title?: string
          media_type?: string
          playlist_id?: string
          position?: number
          poster_path?: string | null
          tmdb_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          handle: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          id: string
          parent_id: string | null
          review_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_id?: string | null
          review_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_id?: string | null
          review_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          media_type: string
          rating: number
          tmdb_id: number
          updated_at: string
          user_id: string
          youtube_video_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          media_type: string
          rating: number
          tmdb_id: number
          updated_at?: string
          user_id: string
          youtube_video_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          media_type?: string
          rating?: number
          tmdb_id?: number
          updated_at?: string
          user_id?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_likes: {
        Row: {
          created_at: string
          media_type: string
          tmdb_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          media_type: string
          tmdb_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          media_type?: string
          tmdb_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watched: {
        Row: {
          genre_ids: number[]
          media_title: string
          media_type: string
          poster_path: string | null
          tmdb_id: number
          user_id: string
          watched_at: string
        }
        Insert: {
          genre_ids?: number[]
          media_title: string
          media_type: string
          poster_path?: string | null
          tmdb_id: number
          user_id: string
          watched_at?: string
        }
        Update: {
          genre_ids?: number[]
          media_title?: string
          media_type?: string
          poster_path?: string | null
          tmdb_id?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_review_like: { Args: { p_review_id: string; p_liked: boolean }; Returns: undefined }
      review_like_summaries: { Args: { p_review_ids: string[] }; Returns: { review_id: string; like_count: number; liked: boolean; comment_count: number }[] }
      create_review_comment: { Args: { p_review_id: string; p_parent_id: string | null; p_body: string }; Returns: string }
      update_review_comment: { Args: { p_comment_id: string; p_body: string }; Returns: undefined }
      delete_review_comment: { Args: { p_comment_id: string }; Returns: undefined }
      review_comments_page: { Args: { p_review_id: string; p_parent_id: string | null; p_after_created_at: string | null; p_after_id: string | null; p_limit: number }; Returns: { id: string; review_id: string; parent_id: string | null; user_id: string | null; body: string | null; created_at: string; updated_at: string; deleted_at: string | null; display_name: string | null; handle: string | null; avatar_url: string | null }[] }

      following_feed: {
        Args: { p_before_created_at?: string; p_before_id?: string }
        Returns: { id: string; media_type: string; tmdb_id: number; rating: number; body: string | null; youtube_video_id: string | null; created_at: string; display_name: string; handle: string; avatar_url: string | null }[]
      }
      append_playlist_item: {
        Args: {
          p_media_title: string
          p_media_type: string
          p_playlist_id: string
          p_poster_path?: string
          p_tmdb_id: number
        }
        Returns: undefined
      }
      most_liked_titles: {
        Args: { p_limit: number; p_media_type: string } | { p_limit?: number }
        Returns: {
          like_count: number
          media_type: string
          tmdb_id: number
        }[]
      }
      person_rating_stats: {
        Args: { p_person_id: number }
        Returns: {
          average_rating: number
          review_count: number
        }[]
      }
      profile_stats: {
        Args: { p_profile_id: string }
        Returns: {
          follower_count: number
          following_count: number
          genre_counts: Json
          like_count: number
          movie_count: number
          review_count: number
          series_count: number
        }[]
      }
      remove_playlist_item: {
        Args: { p_item_id: string; p_playlist_id: string }
        Returns: undefined
      }
      reorder_playlist_items: {
        Args: {
          p_expected_ids: string[]
          p_item_ids: string[]
          p_playlist_id: string
        }
        Returns: undefined
      }
      save_person_review: {
        Args: {
          p_body: string
          p_expected_updated_at?: string
          p_person_id: number
          p_rating: number
          p_works: Json
        }
        Returns: string
      }
      title_like_count: {
        Args: { p_media_type: string; p_tmdb_id: number }
        Returns: number
      }
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
