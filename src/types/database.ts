export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        id: string
        full_name: string
        email: string
        phone: string | null
        platform_role: "super_admin" | "staff" | null
        is_active: boolean
        must_change_password: boolean
        email_notifications: boolean
        created_at: string
        updated_at: string
      }>
      organizations: Table<{
        id: string
        name: string
        slug: string
        request_prefix: string
        status: "active" | "paused" | "offboarded"
        response_hours: number
        urgent_limit_per_month: number
        storage_limit_mb: number
        request_seq: number
        created_by: string | null
        created_at: string
        updated_at: string
      }>
      org_members: Table<{
        org_id: string
        user_id: string
        role: "client_owner" | "client_member"
        created_at: string
        updated_at: string
      }>
      brand_accounts: Table<{
        id: string
        org_id: string
        instagram_handle: string
        facebook_page_name: string | null
        ad_account_label: string | null
        is_professional_account: boolean
        is_public_account: boolean
        access_checklist_status: "not_started" | "in_progress" | "ready" | "blocked"
        notes_for_client: string
        created_at: string
        updated_at: string
      }>
      products: Table<{
        id: string
        org_id: string
        name: string
        category: string | null
        price_inr: number | null
        offer_price_inr: number | null
        sizes_variants: string | null
        stock_status: "in_stock" | "low" | "out_of_stock" | "unknown"
        product_url: string | null
        description: string | null
        is_archived: boolean
        created_at: string
        updated_at: string
      }>
      requests: Table<{
        id: string
        org_id: string
        brand_account_id: string | null
        request_number: string
        title: string
        status: "submitted" | "in_review" | "needs_info" | "ready_to_launch" | "live" | "paused" | "completed" | "rejected" | "cancelled"
        priority: "normal" | "urgent"
        blocker: "none" | "waiting_on_client" | "waiting_on_creator_approval" | "waiting_on_agency" | "waiting_on_meta"
        blocker_note: string | null
        objective: string | null
        destination_type: "whatsapp" | "website" | "profile" | "instagram_dm" | "call" | "other" | null
        destination_value: string | null
        budget_inr: number | null
        budget_type: "daily" | "total" | null
        start_date: string | null
        end_date: string | null
        offer_end_date: string | null
        locations: string | null
        audience_notes: string | null
        language: string | null
        offer_details: string | null
        client_notes: string | null
        rights_confirmed: boolean
        rights_confirmed_at: string | null
        submitted_by: string | null
        assigned_to: string | null
        first_response_due_at: string | null
        first_response_at: string | null
        went_live_at: string | null
        closed_at: string | null
        created_at: string
        updated_at: string
      }>
      request_links: Table<{
        id: string
        request_id: string
        original_url: string
        normalized_url: string
        shortcode: string | null
        link_type: "post" | "reel" | "tv" | "share" | "other"
        product_id: string | null
        permission_method: "unknown" | "own_account" | "ad_code" | "partner_boost" | "account_level"
        permission_status: "not_checked" | "requested" | "received" | "approved" | "blocked"
        ad_code: string | null
        music_check: "not_checked" | "ok" | "issue"
        staff_only_check_notes: string | null
        sort_order: number
        created_at: string
        updated_at: string
      }>
      request_assets: Table<{
        id: string
        org_id: string
        request_id: string | null
        kind: "reference_video" | "screenshot" | "product_image" | "other"
        storage_path: string | null
        external_url: string | null
        file_name: string | null
        mime_type: string | null
        size_bytes: number | null
        uploaded_by: string | null
        created_at: string
        updated_at: string
      }>
      request_events: Table<{
        id: string
        org_id: string
        request_id: string
        event_type: string
        from_value: string | null
        to_value: string | null
        actor_id: string | null
        client_visible: boolean
        created_at: string
      }>
      internal_notes: Table<{
        id: string
        org_id: string
        request_id: string
        author_id: string | null
        body: string
        created_at: string
        updated_at: string
      }>
      ad_records: Table<{
        id: string
        org_id: string
        request_id: string
        request_link_id: string | null
        campaign_name: string | null
        meta_campaign_id: string | null
        meta_adset_id: string | null
        meta_ad_id: string | null
        status: "draft" | "pending_review" | "active" | "paused" | "completed" | "rejected"
        spend_inr: number | null
        results_label: string | null
        results_count: number | null
        last_updated_at: string | null
        client_visible_note: string | null
        created_at: string
        updated_at: string
      }>
      channels: Table<{
        id: string
        org_id: string
        name: string
        is_default: boolean
        created_at: string
        updated_at: string
      }>
      audit_logs: Table<{
        id: string
        actor_id: string | null
        org_id: string | null
        action: string
        target_type: string
        target_id: string | null
        metadata: Json
        created_at: string
      }>
      notifications: Table<{
        id: string
        user_id: string
        org_id: string | null
        type: string
        title: string
        body: string
        link: string | null
        read_at: string | null
        created_at: string
      }>
      push_subscriptions: Table<{
        id: string
        user_id: string
        endpoint: string
        p256dh: string
        auth: string
        created_at: string
      }>
      request_drafts: Table<{
        id: string
        org_id: string
        user_id: string
        payload: Json
        created_at: string
        updated_at: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      submit_request: { Args: { p_org_id: string; p_payload: Json }; Returns: string }
      update_submitted_request: { Args: { p_request_id: string; p_payload: Json }; Returns: undefined }
      cancel_request: { Args: { p_request_id: string }; Returns: undefined }
      request_change: { Args: { p_request_id: string; p_note: string }; Returns: undefined }
      change_request_status: {
        Args: { p_request_id: string; p_status: string; p_note?: string }
        Returns: undefined
      }
      set_request_blocker: {
        Args: { p_request_id: string; p_blocker: string; p_note?: string }
        Returns: undefined
      }
      set_request_assignment: {
        Args: { p_request_id: string; p_assignee: string | null }
        Returns: undefined
      }
      update_link_checks: {
        Args: {
          p_link_id: string
          p_method: string
          p_status: string
          p_ad_code: string
          p_music: string
          p_notes: string
        }
        Returns: undefined
      }
      complete_password_change: { Args: Record<string, never>; Returns: undefined }
      client_request_list: {
        Args: { p_org_id: string; p_status?: string; p_query?: string }
        Returns: Json
      }
      client_request_detail: { Args: { p_request_id: string }; Returns: Json }
      client_request_support: { Args: { p_org_id: string }; Returns: Json }
      find_duplicate_links: {
        Args: { p_org_id: string; p_normalized: string[]; p_shortcodes: string[] }
        Returns: Json
      }
      agency_dashboard: { Args: Record<string, never>; Returns: Json }
      provision_client: {
        Args: {
          p_actor: string
          p_user_id: string
          p_full_name: string
          p_org_name: string
          p_slug: string
          p_prefix: string
          p_instagram_handle: string
          p_force_password: boolean
        }
        Returns: string
      }
      add_org_member: {
        Args: {
          p_actor: string
          p_user_id: string
          p_org_id: string
          p_role: string
          p_full_name: string
          p_new_user: boolean
        }
        Returns: undefined
      }
      consume_rate_limit: {
        Args: {
          p_action: string
          p_subject_hash: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
