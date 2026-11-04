
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"game_id": string | null,"id": string,"is_helpful": boolean,"label": string | null,"parent_id": string | null,"post_id": string | null,"question_id": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"game_id"?: string | null,"id"?: string,"is_helpful"?: boolean,"label"?: string | null,"parent_id"?: string | null,"post_id"?: string | null,"question_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"game_id"?: string | null,"id"?: string,"is_helpful"?: boolean,"label"?: string | null,"parent_id"?: string | null,"post_id"?: string | null,"question_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "game_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"copyright_claims": {
                  Row: {
                    "claimant_email": string,"claimant_name": string,"claimant_org": string | null,"created_at": string,"game_id": string | null,"handled_at": string | null,"handled_by": string | null,"id": string,"infringing_urls": (string)[],"original_url": string | null,"post_id": string | null,"resolution_note": string | null,"signature": string,"statement_accuracy": boolean,"statement_good_faith": boolean,"status": string,"work_description": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimant_email": string,"claimant_name": string,"claimant_org"?: string | null,"created_at"?: string,"game_id"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"infringing_urls": (string)[],"original_url"?: string | null,"post_id"?: string | null,"resolution_note"?: string | null,"signature": string,"statement_accuracy": boolean,"statement_good_faith": boolean,"status"?: string,"work_description": string
                  }
                  Update: {
                    "claimant_email"?: string,"claimant_name"?: string,"claimant_org"?: string | null,"created_at"?: string,"game_id"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"infringing_urls"?: (string)[],"original_url"?: string | null,"post_id"?: string | null,"resolution_note"?: string | null,"signature"?: string,"statement_accuracy"?: boolean,"statement_good_faith"?: boolean,"status"?: string,"work_description"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "copyright_claims_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "copyright_claims_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "copyright_claims_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"engines": {
                  Row: {
                    "id": string,"search_terms": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"search_terms"?: string,"sort"?: number
                  }
                  Update: {
                    "id"?: string,"search_terms"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"featured_games": {
                  Row: {
                    "chosen_by": string | null,"created_at": string,"game_id": string,"quote": string | null,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chosen_by"?: string | null,"created_at"?: string,"game_id": string,"quote"?: string | null,"week_start": string
                  }
                  Update: {
                    "chosen_by"?: string | null,"created_at"?: string,"game_id"?: string,"quote"?: string | null,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "featured_games_chosen_by_fkey"
      columns: ["chosen_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_games_game_id_fkey"
      columns: ["game_id"]
isOneToOne: true
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"followee_id": string,"follower_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followee_id": string,"follower_id": string
                  }
                  Update: {
                    "created_at"?: string,"followee_id"?: string,"follower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_likes": {
                  Row: {
                    "created_at": string,"game_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_likes_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_questions": {
                  Row: {
                    "game_id": string,"id": string,"position": number,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"id"?: string,"position": number,"question": string
                  }
                  Update: {
                    "game_id"?: string,"id"?: string,"position"?: number,"question"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_questions_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"game_saves": {
                  Row: {
                    "created_at": string,"game_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_saves_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_screenshots": {
                  Row: {
                    "alt_text": string,"created_at": string,"game_id": string,"id": string,"path": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string,"created_at"?: string,"game_id": string,"id"?: string,"path": string,"position": number
                  }
                  Update: {
                    "alt_text"?: string,"created_at"?: string,"game_id"?: string,"id"?: string,"path"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_screenshots_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"game_versions": {
                  Row: {
                    "attempts": number,"changelog": string,"created_at": string,"declared_size_bytes": number | null,"detected_engine": string | null,"entry_path": string,"error_code": string | null,"error_params": NonNullable<Json>,"file_count": number | null,"game_id": string,"id": string,"label": string,"locked_at": string | null,"locked_by": string | null,"needs_isolation": boolean,"number": number,"processed_at": string | null,"quarantine_key": string | null,"scan_flags": NonNullable<Json>,"size_bytes": number | null,"status": string,"unpacked_bytes": number | null,"uploaded_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"changelog"?: string,"created_at"?: string,"declared_size_bytes"?: number | null,"detected_engine"?: string | null,"entry_path"?: string,"error_code"?: string | null,"error_params"?: NonNullable<Json>,"file_count"?: number | null,"game_id": string,"id"?: string,"label": string,"locked_at"?: string | null,"locked_by"?: string | null,"needs_isolation"?: boolean,"number": number,"processed_at"?: string | null,"quarantine_key"?: string | null,"scan_flags"?: NonNullable<Json>,"size_bytes"?: number | null,"status"?: string,"unpacked_bytes"?: number | null,"uploaded_at"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"changelog"?: string,"created_at"?: string,"declared_size_bytes"?: number | null,"detected_engine"?: string | null,"entry_path"?: string,"error_code"?: string | null,"error_params"?: NonNullable<Json>,"file_count"?: number | null,"game_id"?: string,"id"?: string,"label"?: string,"locked_at"?: string | null,"locked_by"?: string | null,"needs_isolation"?: boolean,"number"?: number,"processed_at"?: string | null,"quarantine_key"?: string | null,"scan_flags"?: NonNullable<Json>,"size_bytes"?: number | null,"status"?: string,"unpacked_bytes"?: number | null,"uploaded_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_versions_detected_engine_fkey"
      columns: ["detected_engine"]
isOneToOne: false
      referencedRelation: "engines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_versions_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "active_version_id": string | null,"comment_count": number,"controls": string,"cover_path": string | null,"created_at": string,"display_ratio": string,"engine_id": string | null,"external_url": string | null,"genre_id": string | null,"id": string,"is_first_game": boolean,"like_count": number,"owner_id": string,"play_count": number,"public_id": string,"published_at": string | null,"save_count": number,"search_doc": unknown,"share_count": number,"short_description": string,"status": string,"tags": (string)[],"title": string,"updated_at": string,"works_on_mobile": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active_version_id"?: string | null,"comment_count"?: number,"controls"?: string,"cover_path"?: string | null,"created_at"?: string,"display_ratio"?: string,"engine_id"?: string | null,"external_url"?: string | null,"genre_id"?: string | null,"id"?: string,"is_first_game"?: boolean,"like_count"?: number,"owner_id": string,"play_count"?: number,"public_id"?: string,"published_at"?: string | null,"save_count"?: number,"search_doc"?: unknown,"share_count"?: number,"short_description"?: string,"status"?: string,"tags"?: (string)[],"title": string,"updated_at"?: string,"works_on_mobile"?: boolean
                  }
                  Update: {
                    "active_version_id"?: string | null,"comment_count"?: number,"controls"?: string,"cover_path"?: string | null,"created_at"?: string,"display_ratio"?: string,"engine_id"?: string | null,"external_url"?: string | null,"genre_id"?: string | null,"id"?: string,"is_first_game"?: boolean,"like_count"?: number,"owner_id"?: string,"play_count"?: number,"public_id"?: string,"published_at"?: string | null,"save_count"?: number,"search_doc"?: unknown,"share_count"?: number,"short_description"?: string,"status"?: string,"tags"?: (string)[],"title"?: string,"updated_at"?: string,"works_on_mobile"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_active_version_fk"
      columns: ["active_version_id","id"]
isOneToOne: false
      referencedRelation: "game_versions"
      referencedColumns: ["id","game_id"]
    },{
      foreignKeyName: "games_engine_id_fkey"
      columns: ["engine_id"]
isOneToOne: false
      referencedRelation: "engines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_genre_id_fkey"
      columns: ["genre_id"]
isOneToOne: false
      referencedRelation: "genres"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"genres": {
                  Row: {
                    "id": string,"search_terms": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"search_terms"?: string,"sort"?: number
                  }
                  Update: {
                    "id"?: string,"search_terms"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"moderation_log": {
                  Row: {
                    "action": string,"admin_id": string,"admin_username": string,"created_at": string,"id": number,"reason": string | null,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id": string,"admin_username": string,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string,"admin_username"?: string,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"comment_id": string | null,"created_at": string,"data": NonNullable<Json>,"game_id": string | null,"id": string,"post_id": string | null,"read_at": string | null,"type": string,"user_id": string,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"game_id"?: string | null,"id"?: string,"post_id"?: string | null,"read_at"?: string | null,"type": string,"user_id": string,"version_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"game_id"?: string | null,"id"?: string,"post_id"?: string | null,"read_at"?: string | null,"type"?: string,"user_id"?: string,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "game_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"plays": {
                  Row: {
                    "active_seconds": number,"device": string,"game_id": string,"id": string,"last_beat_at": string,"session_id": string,"started_at": string,"user_id": string | null,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_seconds"?: number,"device": string,"game_id": string,"id"?: string,"last_beat_at"?: string,"session_id": string,"started_at"?: string,"user_id"?: string | null,"version_id"?: string | null
                  }
                  Update: {
                    "active_seconds"?: number,"device"?: string,"game_id"?: string,"id"?: string,"last_beat_at"?: string,"session_id"?: string,"started_at"?: string,"user_id"?: string | null,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "plays_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plays_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plays_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "game_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"post_likes": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_media": {
                  Row: {
                    "alt_text": string,"bytes": number,"created_at": string,"height": number | null,"id": string,"kind": string,"mime": string,"path": string,"position": number,"post_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string,"bytes": number,"created_at"?: string,"height"?: number | null,"id"?: string,"kind": string,"mime": string,"path": string,"position": number,"post_id": string,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string,"bytes"?: number,"created_at"?: string,"height"?: number | null,"id"?: string,"kind"?: string,"mime"?: string,"path"?: string,"position"?: number,"post_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_saves": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_saves_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"body": string,"comment_count": number,"created_at": string,"game_id": string | null,"highlight": string | null,"id": string,"kind": string,"like_count": number,"save_count": number,"share_count": number,"status": string,"updated_at": string,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"comment_count"?: number,"created_at"?: string,"game_id"?: string | null,"highlight"?: string | null,"id"?: string,"kind": string,"like_count"?: number,"save_count"?: number,"share_count"?: number,"status"?: string,"updated_at"?: string,"version_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"comment_count"?: number,"created_at"?: string,"game_id"?: string | null,"highlight"?: string | null,"id"?: string,"kind"?: string,"like_count"?: number,"save_count"?: number,"share_count"?: number,"status"?: string,"updated_at"?: string,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_version_fk"
      columns: ["version_id","game_id"]
isOneToOne: false
      referencedRelation: "game_versions"
      referencedColumns: ["id","game_id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "age_confirmed_at": string,"created_at": string,"id": string,"locale": string,"role": string,"status": string,"suspended_until": string | null,"suspension_reason": string | null,"terms_accepted_at": string,"terms_version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "age_confirmed_at": string,"created_at"?: string,"id": string,"locale"?: string,"role"?: string,"status"?: string,"suspended_until"?: string | null,"suspension_reason"?: string | null,"terms_accepted_at": string,"terms_version": string
                  }
                  Update: {
                    "age_confirmed_at"?: string,"created_at"?: string,"id"?: string,"locale"?: string,"role"?: string,"status"?: string,"suspended_until"?: string | null,"suspension_reason"?: string | null,"terms_accepted_at"?: string,"terms_version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string,"city": string | null,"country": string | null,"created_at": string,"display_name": string,"engines": (string)[],"favorite_genres": (string)[],"followers_count": number,"following_count": number,"id": string,"updated_at": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string,"city"?: string | null,"country"?: string | null,"created_at"?: string,"display_name": string,"engines"?: (string)[],"favorite_genres"?: (string)[],"followers_count"?: number,"following_count"?: number,"id": string,"updated_at"?: string,"username": string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string,"city"?: string | null,"country"?: string | null,"created_at"?: string,"display_name"?: string,"engines"?: (string)[],"favorite_genres"?: (string)[],"followers_count"?: number,"following_count"?: number,"id"?: string,"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"detail": string,"id": string,"reason": string,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"snapshot": NonNullable<Json>,"status": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: string,"id"?: string,"reason": string,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"snapshot"?: NonNullable<Json>,"status"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"snapshot"?: NonNullable<Json>,"status"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "complete_onboarding":
{ Args: { "p_accept_terms": boolean,"p_age_confirmed": boolean,"p_display_name": string,"p_locale"?: string,"p_terms_version": string,"p_username": string }; Returns: {
              "avatar_path": string | null,
"bio": string,
"city": string | null,
"country": string | null,
"created_at": string,
"display_name": string,
"engines": (string)[],
"favorite_genres": (string)[],
"followers_count": number,
"following_count": number,
"id": string,
"updated_at": string,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"username_available":
{ Args: { "p_username": string }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
