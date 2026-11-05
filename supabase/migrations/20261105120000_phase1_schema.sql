-- AdDesk phase 1 schema.
-- Instagram, Facebook, and Meta passwords are never stored.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums --------------------------------------------------------------------

CREATE TYPE public.platform_role AS ENUM ('super_admin', 'staff');
CREATE TYPE public.org_role AS ENUM ('client_owner', 'client_member');
CREATE TYPE public.org_status AS ENUM ('active', 'paused', 'offboarded');
CREATE TYPE public.request_status AS ENUM (
  'submitted', 'in_review', 'needs_info', 'ready_to_launch',
  'live', 'paused', 'completed', 'rejected', 'cancelled'
);
CREATE TYPE public.request_priority AS ENUM ('normal', 'urgent');
CREATE TYPE public.request_blocker AS ENUM (
  'none', 'waiting_on_client', 'waiting_on_creator_approval',
  'waiting_on_agency', 'waiting_on_meta'
);
CREATE TYPE public.destination_type AS ENUM (
  'whatsapp', 'website', 'profile', 'instagram_dm', 'call', 'other'
);
CREATE TYPE public.budget_type AS ENUM ('daily', 'total');
CREATE TYPE public.link_type AS ENUM ('post', 'reel', 'tv', 'share', 'other');
CREATE TYPE public.permission_method AS ENUM (
  'unknown', 'own_account', 'ad_code', 'partner_boost', 'account_level'
);
CREATE TYPE public.permission_status AS ENUM (
  'not_checked', 'requested', 'received', 'approved', 'blocked'
);
CREATE TYPE public.music_check AS ENUM ('not_checked', 'ok', 'issue');
CREATE TYPE public.asset_kind AS ENUM (
  'reference_video', 'screenshot', 'product_image', 'other'
);
CREATE TYPE public.stock_status AS ENUM ('in_stock', 'low', 'out_of_stock', 'unknown');
CREATE TYPE public.access_checklist_status AS ENUM (
  'not_started', 'in_progress', 'ready', 'blocked'
);
CREATE TYPE public.ad_record_status AS ENUM (
  'draft', 'pending_review', 'active', 'paused', 'completed', 'rejected'
);

-- Tables -------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  phone text,
  platform_role public.platform_role,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  request_prefix text NOT NULL UNIQUE CHECK (request_prefix ~ '^[A-Z0-9]{2,6}$'),
  status public.org_status NOT NULL DEFAULT 'active',
  response_hours integer NOT NULL DEFAULT 24 CHECK (response_hours BETWEEN 1 AND 168),
  urgent_limit_per_month integer NOT NULL DEFAULT 2 CHECK (urgent_limit_per_month BETWEEN 0 AND 20),
  storage_limit_mb integer NOT NULL DEFAULT 2048 CHECK (storage_limit_mb > 0),
  request_seq bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.org_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE public.brand_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instagram_handle text NOT NULL,
  facebook_page_name text,
  ad_account_label text,
  is_professional_account boolean NOT NULL DEFAULT false,
  is_public_account boolean NOT NULL DEFAULT false,
  access_checklist_status public.access_checklist_status NOT NULL DEFAULT 'not_started',
  notes_for_client text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  price_inr numeric(12, 2),
  offer_price_inr numeric(12, 2),
  sizes_variants text,
  stock_status public.stock_status NOT NULL DEFAULT 'unknown',
  product_url text,
  description text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  brand_account_id uuid REFERENCES public.brand_accounts (id),
  request_number text NOT NULL UNIQUE,
  title text NOT NULL,
  status public.request_status NOT NULL DEFAULT 'submitted',
  priority public.request_priority NOT NULL DEFAULT 'normal',
  blocker public.request_blocker NOT NULL DEFAULT 'waiting_on_agency',
  blocker_note text,
  objective text,
  destination_type public.destination_type,
  destination_value text,
  budget_inr numeric(12, 2) CHECK (budget_inr IS NULL OR budget_inr >= 0),
  budget_type public.budget_type,
  start_date date,
  end_date date,
  offer_end_date date,
  locations text,
  audience_notes text,
  language text,
  offer_details text,
  client_notes text,
  rights_confirmed boolean NOT NULL DEFAULT false,
  rights_confirmed_at timestamptz,
  submitted_by uuid,
  assigned_to uuid,
  first_response_due_at timestamptz,
  first_response_at timestamptz,
  went_live_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requests_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles (id),
  CONSTRAINT requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles (id)
);

CREATE TABLE public.request_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests (id) ON DELETE CASCADE,
  original_url text NOT NULL,
  normalized_url text NOT NULL,
  shortcode text,
  link_type public.link_type NOT NULL,
  product_id uuid REFERENCES public.products (id),
  permission_method public.permission_method NOT NULL DEFAULT 'unknown',
  permission_status public.permission_status NOT NULL DEFAULT 'not_checked',
  ad_code text,
  music_check public.music_check NOT NULL DEFAULT 'not_checked',
  staff_only_check_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.request_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.requests (id) ON DELETE CASCADE,
  kind public.asset_kind NOT NULL,
  storage_path text,
  external_url text,
  file_name text,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_assets_has_location CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);

CREATE TABLE public.request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.requests (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_value text,
  to_value text,
  actor_id uuid REFERENCES public.profiles (id),
  client_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.requests (id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ad_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.requests (id) ON DELETE CASCADE,
  request_link_id uuid REFERENCES public.request_links (id) ON DELETE SET NULL,
  campaign_name text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  status public.ad_record_status NOT NULL DEFAULT 'draft',
  spend_inr numeric(12, 2),
  results_label text,
  results_count numeric(12, 2),
  last_updated_at timestamptz,
  client_visible_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX channels_one_default_per_org
  ON public.channels (org_id)
  WHERE is_default;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.requests (id) ON DELETE SET NULL,
  sender_id uuid REFERENCES public.profiles (id),
  body text NOT NULL,
  parent_message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.message_reads (
  channel_id uuid NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.request_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE public.auth_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  subject_hash text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX requests_org_status_idx ON public.requests (org_id, status);
CREATE INDEX requests_due_idx ON public.requests (first_response_due_at);
CREATE INDEX requests_assigned_idx ON public.requests (assigned_to);
CREATE INDEX org_members_user_idx ON public.org_members (user_id);
CREATE INDEX request_links_request_idx ON public.request_links (request_id);
CREATE INDEX request_links_normalized_idx ON public.request_links (normalized_url);
CREATE INDEX request_links_shortcode_idx ON public.request_links (shortcode);
CREATE INDEX request_events_request_idx ON public.request_events (request_id, created_at);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX auth_rate_limits_lookup_idx ON public.auth_rate_limits (action, subject_hash, attempted_at);
CREATE INDEX messages_channel_idx ON public.messages (channel_id, created_at);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
