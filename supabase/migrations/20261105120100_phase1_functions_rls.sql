-- AdDesk phase 1 functions, triggers, and row level security.
-- Helper functions are SECURITY DEFINER with a fixed search_path.
-- Roles are read from tables, never from user_metadata.

-- Helpers ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at(target regclass)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
    target
  );
END;
$$;

SELECT public.touch_updated_at('public.profiles');
SELECT public.touch_updated_at('public.organizations');
SELECT public.touch_updated_at('public.org_members');
SELECT public.touch_updated_at('public.brand_accounts');
SELECT public.touch_updated_at('public.products');
SELECT public.touch_updated_at('public.requests');
SELECT public.touch_updated_at('public.request_links');
SELECT public.touch_updated_at('public.request_assets');
SELECT public.touch_updated_at('public.internal_notes');
SELECT public.touch_updated_at('public.ad_records');
SELECT public.touch_updated_at('public.channels');
SELECT public.touch_updated_at('public.request_drafts');

CREATE OR REPLACE FUNCTION public.is_privileged_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(current_setting('app.allow_profile_admin', true), '') = 'on'
    OR (
      coalesce(auth.role(), '') = ''
      AND session_user IN ('postgres', 'supabase_admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_agency()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND platform_role IN ('super_admin', 'staff')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND platform_role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members AS member
    JOIN public.profiles AS profile ON profile.id = member.user_id
    WHERE member.org_id = target_org
      AND member.user_id = auth.uid()
      AND profile.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.request_transition_allowed(
  from_status public.request_status,
  to_status public.request_status
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE from_status
    WHEN 'submitted' THEN to_status IN ('in_review', 'needs_info', 'rejected', 'cancelled')
    WHEN 'in_review' THEN to_status IN ('needs_info', 'ready_to_launch', 'rejected', 'cancelled')
    WHEN 'needs_info' THEN to_status IN ('in_review', 'cancelled')
    WHEN 'ready_to_launch' THEN to_status IN ('live', 'needs_info', 'cancelled')
    WHEN 'live' THEN to_status IN ('paused', 'completed')
    WHEN 'paused' THEN to_status IN ('live', 'completed')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.kolkata_month_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata');
$$;

-- Profile and membership protection ---------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_admins integer;
BEGIN
  IF NEW.platform_role IS NOT DISTINCT FROM OLD.platform_role
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
     AND NEW.must_change_password IS NOT DISTINCT FROM OLD.must_change_password
     AND NEW.email IS NOT DISTINCT FROM OLD.email
  THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_privileged_session() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF OLD.platform_role = 'super_admin'
     AND OLD.is_active
     AND (NEW.platform_role IS DISTINCT FROM 'super_admin' OR NEW.is_active = false)
  THEN
    SELECT count(*) INTO remaining_admins
    FROM public.profiles
    WHERE platform_role = 'super_admin'
      AND is_active
      AND id <> OLD.id;
    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'last_super_admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

CREATE OR REPLACE FUNCTION public.protect_org_member_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id AND NEW.org_id IS NOT DISTINCT FROM OLD.org_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_privileged_session() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_org_member_columns
BEFORE INSERT OR UPDATE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.protect_org_member_columns();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    PERFORM set_config('app.allow_profile_admin', 'on', true);
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

CREATE OR REPLACE FUNCTION public.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'append_only';
END;
$$;

CREATE TRIGGER request_events_append_only
BEFORE UPDATE OR DELETE ON public.request_events
FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();

CREATE OR REPLACE FUNCTION public.lock_request_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.request_number IS DISTINCT FROM OLD.request_number
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
  THEN
    RAISE EXCEPTION 'locked_field';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lock_request_identity
BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.lock_request_identity();

CREATE OR REPLACE FUNCTION public.enforce_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.request_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'invalid_status';
    END IF;

    IF NEW.status = 'needs_info' THEN
      NEW.blocker = 'waiting_on_client';
    ELSIF NEW.status IN ('in_review', 'ready_to_launch') THEN
      NEW.blocker = 'waiting_on_agency';
    ELSIF NEW.status IN ('live', 'paused', 'completed', 'rejected', 'cancelled') THEN
      NEW.blocker = 'none';
    END IF;

    IF NEW.status = 'live' AND OLD.went_live_at IS NULL THEN
      NEW.went_live_at = now();
    END IF;

    IF NEW.status IN ('completed', 'rejected', 'cancelled') AND OLD.closed_at IS NULL THEN
      NEW.closed_at = now();
    END IF;

    INSERT INTO public.request_events (
      org_id, request_id, event_type, from_value, to_value, actor_id, client_visible
    ) VALUES (
      NEW.org_id, NEW.id, 'status_changed', OLD.status::text, NEW.status::text, auth.uid(), true
    );
  END IF;

  IF public.is_agency()
     AND OLD.first_response_at IS NULL
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.blocker IS DISTINCT FROM OLD.blocker
       OR NEW.blocker_note IS DISTINCT FROM OLD.blocker_note
     )
  THEN
    NEW.first_response_at = now();
  END IF;

  IF NEW.blocker IS DISTINCT FROM OLD.blocker AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_events (
      org_id, request_id, event_type, from_value, to_value, actor_id, client_visible
    ) VALUES (
      NEW.org_id, NEW.id, 'blocker_changed', OLD.blocker::text, NEW.blocker::text, auth.uid(), true
    );
  END IF;

  IF NEW.blocker_note IS DISTINCT FROM OLD.blocker_note THEN
    INSERT INTO public.request_events (
      org_id, request_id, event_type, from_value, to_value, actor_id, client_visible
    ) VALUES (
      NEW.org_id, NEW.id, 'blocker_note_changed', left(OLD.blocker_note, 500), left(NEW.blocker_note, 500), auth.uid(), true
    );
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.request_events (
      org_id, request_id, event_type, from_value, to_value, actor_id, client_visible
    ) VALUES (
      NEW.org_id, NEW.id, 'assignment_changed', NULL, NULL, auth.uid(), false
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_request_update
BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_request_update();

CREATE OR REPLACE FUNCTION public.guard_request_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id = auth.uid();
  IF NOT public.is_org_member(NEW.org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_request_draft
BEFORE INSERT OR UPDATE ON public.request_drafts
FOR EACH ROW EXECUTE FUNCTION public.guard_request_draft();

-- Request writes ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.urgent_count(target_org uuid, except_request uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.requests
  WHERE org_id = target_org
    AND priority = 'urgent'
    AND status <> 'cancelled'
    AND created_at >= public.kolkata_month_start()
    AND (except_request IS NULL OR id <> except_request);
$$;

CREATE OR REPLACE FUNCTION public.insert_request_children(
  p_request_id uuid,
  p_org_id uuid,
  p_links jsonb,
  p_assets jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link jsonb;
  v_asset jsonb;
  v_product uuid;
BEGIN
  IF jsonb_typeof(p_links) <> 'array' OR jsonb_array_length(p_links) < 1 OR jsonb_array_length(p_links) > 10 THEN
    RAISE EXCEPTION 'invalid_links';
  END IF;

  FOR v_link IN SELECT value FROM jsonb_array_elements(p_links)
  LOOP
    IF coalesce(v_link ->> 'normalizedUrl', '') NOT LIKE 'https://www.instagram.com/%'
       AND coalesce(v_link ->> 'normalizedUrl', '') NOT LIKE 'https://instagram.com/%'
    THEN
      RAISE EXCEPTION 'invalid_instagram_url';
    END IF;
    IF coalesce(v_link ->> 'originalUrl', '') NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'invalid_instagram_url';
    END IF;

    v_product = NULL;
    IF coalesce(v_link ->> 'productId', '') <> '' THEN
      v_product = (v_link ->> 'productId')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = v_product AND org_id = p_org_id AND is_archived = false
      ) THEN
        RAISE EXCEPTION 'invalid_product';
      END IF;
    END IF;

    INSERT INTO public.request_links (
      request_id, original_url, normalized_url, shortcode, link_type, product_id, sort_order
    ) VALUES (
      p_request_id,
      v_link ->> 'originalUrl',
      v_link ->> 'normalizedUrl',
      NULLIF(v_link ->> 'shortcode', ''),
      (v_link ->> 'linkType')::public.link_type,
      v_product,
      coalesce((v_link ->> 'sortOrder')::integer, 0)
    );
  END LOOP;

  IF p_assets IS NOT NULL AND jsonb_typeof(p_assets) = 'array' THEN
    IF jsonb_array_length(p_assets) > 10 THEN
      RAISE EXCEPTION 'invalid_assets';
    END IF;
    FOR v_asset IN SELECT value FROM jsonb_array_elements(p_assets)
    LOOP
      IF coalesce(v_asset ->> 'externalUrl', '') NOT LIKE 'https://%' THEN
        RAISE EXCEPTION 'invalid_reference_url';
      END IF;
      INSERT INTO public.request_assets (
        org_id, request_id, kind, external_url, file_name, uploaded_by
      ) VALUES (
        p_org_id,
        p_request_id,
        (v_asset ->> 'kind')::public.asset_kind,
        v_asset ->> 'externalUrl',
        NULLIF(v_asset ->> 'fileName', ''),
        auth.uid()
      );
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_request(p_org_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_brand uuid;
  v_id uuid;
  v_number text;
  v_priority public.request_priority;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF coalesce(p_payload ->> 'rightsConfirmed', '') <> 'true' THEN
    RAISE EXCEPTION 'rights_required';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND OR v_org.status <> 'active' THEN
    RAISE EXCEPTION 'org_not_active';
  END IF;

  v_brand = (p_payload ->> 'brandAccountId')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.brand_accounts WHERE id = v_brand AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'invalid_brand';
  END IF;

  v_priority = (p_payload ->> 'priority')::public.request_priority;
  IF v_priority = 'urgent' AND public.urgent_count(p_org_id) >= v_org.urgent_limit_per_month THEN
    RAISE EXCEPTION 'urgent_limit';
  END IF;

  UPDATE public.organizations
  SET request_seq = request_seq + 1
  WHERE id = p_org_id
  RETURNING request_prefix || '-' || lpad(request_seq::text, 4, '0')
  INTO v_number;

  INSERT INTO public.requests (
    org_id, brand_account_id, request_number, title, status, priority, blocker,
    objective, destination_type, destination_value, budget_inr, budget_type,
    start_date, end_date, offer_end_date, locations, audience_notes, language,
    offer_details, client_notes, rights_confirmed, rights_confirmed_at,
    submitted_by, first_response_due_at
  ) VALUES (
    p_org_id,
    v_brand,
    v_number,
    left(p_payload ->> 'title', 160),
    'submitted',
    v_priority,
    'waiting_on_agency',
    NULLIF(p_payload ->> 'objective', ''),
    NULLIF(p_payload ->> 'destinationType', '')::public.destination_type,
    NULLIF(p_payload ->> 'destinationValue', ''),
    NULLIF(p_payload ->> 'budgetInr', '')::numeric,
    NULLIF(p_payload ->> 'budgetType', '')::public.budget_type,
    NULLIF(p_payload ->> 'startDate', '')::date,
    NULLIF(p_payload ->> 'endDate', '')::date,
    NULLIF(p_payload ->> 'offerEndDate', '')::date,
    NULLIF(p_payload ->> 'locations', ''),
    NULLIF(p_payload ->> 'audienceNotes', ''),
    NULLIF(p_payload ->> 'language', ''),
    NULLIF(p_payload ->> 'offerDetails', ''),
    NULLIF(p_payload ->> 'clientNotes', ''),
    true,
    now(),
    auth.uid(),
    now() + make_interval(hours => v_org.response_hours)
  )
  RETURNING id INTO v_id;

  PERFORM public.insert_request_children(v_id, p_org_id, p_payload -> 'links', p_payload -> 'assets');

  INSERT INTO public.request_events (
    org_id, request_id, event_type, to_value, actor_id, client_visible
  ) VALUES (
    p_org_id, v_id, 'submitted', v_number, auth.uid(), true
  );

  DELETE FROM public.request_drafts WHERE org_id = p_org_id AND user_id = auth.uid();
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_submitted_request(p_request_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_priority public.request_priority;
  v_brand uuid;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_org_member(v_req.org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v_req.status <> 'submitted' THEN
    RAISE EXCEPTION 'not_editable';
  END IF;
  IF coalesce(p_payload ->> 'rightsConfirmed', '') <> 'true' THEN
    RAISE EXCEPTION 'rights_required';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = v_req.org_id;
  v_priority = (p_payload ->> 'priority')::public.request_priority;
  IF v_priority = 'urgent'
     AND v_req.priority <> 'urgent'
     AND public.urgent_count(v_req.org_id, v_req.id) >= v_org.urgent_limit_per_month
  THEN
    RAISE EXCEPTION 'urgent_limit';
  END IF;

  v_brand = (p_payload ->> 'brandAccountId')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.brand_accounts WHERE id = v_brand AND org_id = v_req.org_id
  ) THEN
    RAISE EXCEPTION 'invalid_brand';
  END IF;

  UPDATE public.requests SET
    brand_account_id = v_brand,
    title = left(p_payload ->> 'title', 160),
    priority = v_priority,
    objective = NULLIF(p_payload ->> 'objective', ''),
    destination_type = NULLIF(p_payload ->> 'destinationType', '')::public.destination_type,
    destination_value = NULLIF(p_payload ->> 'destinationValue', ''),
    budget_inr = NULLIF(p_payload ->> 'budgetInr', '')::numeric,
    budget_type = NULLIF(p_payload ->> 'budgetType', '')::public.budget_type,
    start_date = NULLIF(p_payload ->> 'startDate', '')::date,
    end_date = NULLIF(p_payload ->> 'endDate', '')::date,
    offer_end_date = NULLIF(p_payload ->> 'offerEndDate', '')::date,
    locations = NULLIF(p_payload ->> 'locations', ''),
    audience_notes = NULLIF(p_payload ->> 'audienceNotes', ''),
    language = NULLIF(p_payload ->> 'language', ''),
    offer_details = NULLIF(p_payload ->> 'offerDetails', ''),
    client_notes = NULLIF(p_payload ->> 'clientNotes', ''),
    rights_confirmed = true,
    rights_confirmed_at = coalesce(rights_confirmed_at, now())
  WHERE id = p_request_id;

  DELETE FROM public.request_links WHERE request_id = p_request_id;
  DELETE FROM public.request_assets WHERE request_id = p_request_id AND storage_path IS NULL;
  PERFORM public.insert_request_children(p_request_id, v_req.org_id, p_payload -> 'links', p_payload -> 'assets');

  INSERT INTO public.request_events (
    org_id, request_id, event_type, actor_id, client_visible
  ) VALUES (
    v_req.org_id, p_request_id, 'request_edited', auth.uid(), true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_org_member(v_req.org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v_req.status NOT IN ('submitted', 'in_review', 'needs_info', 'ready_to_launch') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  UPDATE public.requests SET status = 'cancelled' WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_change(p_request_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
BEGIN
  IF char_length(coalesce(trim(p_note), '')) < 2 THEN
    RAISE EXCEPTION 'note_required';
  END IF;
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND OR NOT public.is_org_member(v_req.org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v_req.status = 'submitted' OR v_req.status IN ('completed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'not_editable';
  END IF;
  INSERT INTO public.request_events (
    org_id, request_id, event_type, to_value, actor_id, client_visible
  ) VALUES (
    v_req.org_id, p_request_id, 'change_requested', left(trim(p_note), 2000), auth.uid(), true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.change_request_status(
  p_request_id uuid,
  p_status public.request_status,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_agency() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  UPDATE public.requests
  SET status = p_status,
      blocker_note = CASE WHEN p_note IS NULL THEN blocker_note ELSE left(p_note, 2000) END
  WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_request_blocker(
  p_request_id uuid,
  p_blocker public.request_blocker,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_agency() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  UPDATE public.requests
  SET blocker = p_blocker,
      blocker_note = CASE WHEN p_note IS NULL THEN blocker_note ELSE left(p_note, 2000) END
  WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_request_assignment(p_request_id uuid, p_assignee uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_agency() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF p_assignee IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_assignee AND is_active AND platform_role IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'assignee_not_agency';
  END IF;
  UPDATE public.requests SET assigned_to = p_assignee WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_link_checks(
  p_link_id uuid,
  p_method public.permission_method,
  p_status public.permission_status,
  p_ad_code text,
  p_music public.music_check,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.request_links%ROWTYPE;
  v_org uuid;
BEGIN
  IF NOT public.is_agency() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO v_link FROM public.request_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  SELECT org_id INTO v_org FROM public.requests WHERE id = v_link.request_id;
  UPDATE public.request_links SET
    permission_method = p_method,
    permission_status = p_status,
    ad_code = NULLIF(left(coalesce(p_ad_code, ''), 200), ''),
    music_check = p_music,
    staff_only_check_notes = NULLIF(left(coalesce(p_notes, ''), 2000), '')
  WHERE id = p_link_id;

  INSERT INTO public.request_events (
    org_id, request_id, event_type, to_value, actor_id, client_visible
  ) VALUES (
    v_org, v_link.request_id, 'link_checked', p_status::text, auth.uid(), false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  PERFORM set_config('app.allow_profile_admin', 'on', true);
  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid() AND is_active = true;
END;
$$;

-- BEGIN CLIENT SAFE
-- Client read functions. Keep staff-only columns and hidden history out of these return values.

CREATE OR REPLACE FUNCTION public.client_request_list(
  p_org_id uuid,
  p_status text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(item) ORDER BY item.created_at DESC)
    FROM (
      SELECT
        r.id,
        r.request_number,
        r.title,
        r.status,
        r.priority,
        r.blocker,
        r.blocker_note,
        r.first_response_due_at,
        r.first_response_at,
        r.went_live_at,
        r.closed_at,
        r.created_at,
        r.updated_at
      FROM public.requests AS r
      WHERE r.org_id = p_org_id
        AND (p_status IS NULL OR p_status = '' OR r.status::text = p_status)
        AND (
          p_query IS NULL OR btrim(p_query) = ''
          OR r.title ILIKE '%' || replace(p_query, '%', '') || '%'
          OR r.request_number ILIKE '%' || replace(p_query, '%', '') || '%'
        )
    ) AS item
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.client_request_detail(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.requests WHERE id = p_request_id;
  IF v_org IS NULL OR NOT public.is_org_member(v_org) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'request', (
      SELECT jsonb_build_object(
        'id', r.id,
        'org_id', r.org_id,
        'brand_account_id', r.brand_account_id,
        'request_number', r.request_number,
        'title', r.title,
        'status', r.status,
        'priority', r.priority,
        'blocker', r.blocker,
        'blocker_note', r.blocker_note,
        'objective', r.objective,
        'destination_type', r.destination_type,
        'destination_value', r.destination_value,
        'budget_inr', r.budget_inr,
        'budget_type', r.budget_type,
        'start_date', r.start_date,
        'end_date', r.end_date,
        'offer_end_date', r.offer_end_date,
        'locations', r.locations,
        'audience_notes', r.audience_notes,
        'language', r.language,
        'offer_details', r.offer_details,
        'client_notes', r.client_notes,
        'rights_confirmed', r.rights_confirmed,
        'rights_confirmed_at', r.rights_confirmed_at,
        'first_response_due_at', r.first_response_due_at,
        'first_response_at', r.first_response_at,
        'went_live_at', r.went_live_at,
        'closed_at', r.closed_at,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      FROM public.requests AS r
      WHERE r.id = p_request_id
    ),
    'links', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'original_url', l.original_url,
        'normalized_url', l.normalized_url,
        'shortcode', l.shortcode,
        'link_type', l.link_type,
        'product_id', l.product_id,
        'product_name', p.name,
        'sort_order', l.sort_order
      ) ORDER BY l.sort_order, l.created_at)
      FROM public.request_links AS l
      LEFT JOIN public.products AS p ON p.id = l.product_id
      WHERE l.request_id = p_request_id
    ), '[]'::jsonb),
    'assets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'kind', a.kind,
        'external_url', a.external_url,
        'file_name', a.file_name,
        'created_at', a.created_at
      ) ORDER BY a.created_at)
      FROM public.request_assets AS a
      WHERE a.request_id = p_request_id
    ), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'from_value', e.from_value,
        'to_value', e.to_value,
        'created_at', e.created_at,
        'actor_side', CASE
          WHEN e.actor_id = auth.uid() THEN 'you'
          WHEN profile.platform_role IS NOT NULL THEN 'agency'
          ELSE 'client'
        END
      ) ORDER BY e.created_at)
      FROM public.request_events AS e
      LEFT JOIN public.profiles AS profile ON profile.id = e.actor_id
      WHERE e.request_id = p_request_id
        AND e.client_visible = true
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.client_request_support(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'urgent_used', public.urgent_count(p_org_id),
    'urgent_limit', v_org.urgent_limit_per_month,
    'response_hours', v_org.response_hours,
    'status', v_org.status,
    'last_ad', (
      SELECT jsonb_build_object(
        'objective', r.objective,
        'destination_type', r.destination_type,
        'destination_value', r.destination_value,
        'budget_inr', r.budget_inr,
        'budget_type', r.budget_type,
        'start_date', r.start_date,
        'end_date', r.end_date,
        'offer_end_date', r.offer_end_date,
        'locations', r.locations,
        'audience_notes', r.audience_notes,
        'language', r.language,
        'offer_details', r.offer_details,
        'client_notes', r.client_notes
      )
      FROM public.requests AS r
      WHERE r.org_id = p_org_id
      ORDER BY r.created_at DESC
      LIMIT 1
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.find_duplicate_links(
  p_org_id uuid,
  p_normalized text[],
  p_shortcodes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) AND NOT public.is_agency() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'request_number', r.request_number,
      'title', r.title,
      'normalized_url', l.normalized_url,
      'shortcode', l.shortcode
    ))
    FROM public.request_links AS l
    JOIN public.requests AS r ON r.id = l.request_id
    WHERE r.org_id = p_org_id
      AND r.status <> 'cancelled'
      AND (
        l.normalized_url = ANY (coalesce(p_normalized, ARRAY[]::text[]))
        OR (l.shortcode IS NOT NULL AND l.shortcode = ANY (coalesce(p_shortcodes, ARRAY[]::text[])))
      )
  ), '[]'::jsonb);
END;
$$;

-- END CLIENT SAFE

CREATE OR REPLACE FUNCTION public.agency_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_agency() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN jsonb_build_object(
    'submitted', (SELECT count(*) FROM public.requests WHERE status = 'submitted'),
    'overdue', (
      SELECT count(*) FROM public.requests
      WHERE first_response_at IS NULL
        AND first_response_due_at < now()
        AND status NOT IN ('cancelled', 'rejected', 'completed')
    ),
    'waiting_on_agency', (
      SELECT count(*) FROM public.requests
      WHERE blocker = 'waiting_on_agency'
        AND status NOT IN ('cancelled', 'rejected', 'completed')
    ),
    'waiting_on_client', (
      SELECT count(*) FROM public.requests
      WHERE blocker = 'waiting_on_client'
        AND status NOT IN ('cancelled', 'rejected', 'completed')
    ),
    'ready_to_launch', (SELECT count(*) FROM public.requests WHERE status = 'ready_to_launch'),
    'live', (SELECT count(*) FROM public.requests WHERE status = 'live'),
    'overdue_requests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'request_number', r.request_number,
        'title', r.title,
        'status', r.status,
        'org_id', r.org_id,
        'org_name', o.name,
        'first_response_due_at', r.first_response_due_at
      ) ORDER BY r.first_response_due_at)
      FROM (
        SELECT *
        FROM public.requests
        WHERE first_response_at IS NULL
          AND first_response_due_at < now()
          AND status NOT IN ('cancelled', 'rejected', 'completed')
        ORDER BY first_response_due_at
        LIMIT 20
      ) AS r
      JOIN public.organizations AS o ON o.id = r.org_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_client(
  p_actor uuid,
  p_user_id uuid,
  p_full_name text,
  p_org_name text,
  p_slug text,
  p_prefix text,
  p_instagram_handle text,
  p_force_password boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_privileged_session() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  PERFORM set_config('app.allow_profile_admin', 'on', true);
  UPDATE public.profiles
  SET full_name = left(coalesce(p_full_name, full_name), 120),
      must_change_password = CASE WHEN p_force_password THEN true ELSE must_change_password END
  WHERE id = p_user_id;

  INSERT INTO public.organizations (name, slug, request_prefix, created_by)
  VALUES (left(p_org_name, 160), p_slug, p_prefix, p_actor)
  RETURNING id INTO v_org;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org, p_user_id, 'client_owner');

  INSERT INTO public.brand_accounts (org_id, instagram_handle)
  VALUES (v_org, left(p_instagram_handle, 30));

  INSERT INTO public.channels (org_id, name, is_default)
  VALUES (v_org, '#' || p_slug, true);

  INSERT INTO public.audit_logs (actor_id, org_id, action, target_type, target_id, metadata)
  VALUES (
    p_actor, v_org, 'organization_created', 'organization', v_org,
    jsonb_build_object('slug', p_slug, 'owner_id', p_user_id)
  );

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_org_member(
  p_actor uuid,
  p_user_id uuid,
  p_org_id uuid,
  p_role public.org_role,
  p_full_name text,
  p_new_user boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_privileged_session() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.org_members WHERE org_id = p_org_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  PERFORM set_config('app.allow_profile_admin', 'on', true);
  UPDATE public.profiles
  SET full_name = CASE
        WHEN coalesce(p_full_name, '') = '' THEN full_name
        ELSE left(p_full_name, 120)
      END,
      must_change_password = CASE WHEN p_new_user THEN true ELSE must_change_password END
  WHERE id = p_user_id;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (p_org_id, p_user_id, p_role);

  INSERT INTO public.audit_logs (actor_id, org_id, action, target_type, target_id, metadata)
  VALUES (
    p_actor, p_org_id, 'member_added', 'user', p_user_id,
    jsonb_build_object('role', p_role, 'new_user', p_new_user)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_action text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_privileged_session() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  DELETE FROM public.auth_rate_limits
  WHERE attempted_at < now() - interval '2 days';

  SELECT count(*) INTO v_count
  FROM public.auth_rate_limits
  WHERE action = p_action
    AND subject_hash = p_subject_hash
    AND attempted_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.auth_rate_limits (action, subject_hash)
  VALUES (p_action, p_subject_hash);
  RETURN true;
END;
$$;

-- Row level security -------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_agency()
  OR EXISTS (
    SELECT 1
    FROM public.org_members AS mine
    JOIN public.org_members AS theirs ON theirs.org_id = mine.org_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = profiles.id
  )
);

CREATE POLICY organizations_select ON public.organizations
FOR SELECT TO authenticated
USING (public.is_agency() OR public.is_org_member(id));

CREATE POLICY org_members_select ON public.org_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_agency()
  OR public.is_org_member(org_id)
);

CREATE POLICY brand_accounts_select ON public.brand_accounts
FOR SELECT TO authenticated
USING (public.is_agency() OR public.is_org_member(org_id));

CREATE POLICY brand_accounts_insert ON public.brand_accounts
FOR INSERT TO authenticated
WITH CHECK (public.is_agency());

CREATE POLICY brand_accounts_update ON public.brand_accounts
FOR UPDATE TO authenticated
USING (public.is_agency())
WITH CHECK (public.is_agency());

CREATE POLICY products_select ON public.products
FOR SELECT TO authenticated
USING (public.is_agency() OR public.is_org_member(org_id));

CREATE POLICY products_insert ON public.products
FOR INSERT TO authenticated
WITH CHECK (public.is_agency() OR public.is_org_member(org_id));

CREATE POLICY products_update ON public.products
FOR UPDATE TO authenticated
USING (public.is_agency() OR public.is_org_member(org_id))
WITH CHECK (public.is_agency() OR public.is_org_member(org_id));

CREATE POLICY requests_select ON public.requests
FOR SELECT TO authenticated
USING (public.is_agency());

CREATE POLICY requests_update ON public.requests
FOR UPDATE TO authenticated
USING (public.is_agency())
WITH CHECK (public.is_agency());

CREATE POLICY request_links_select ON public.request_links
FOR SELECT TO authenticated
USING (
  public.is_agency()
  AND EXISTS (SELECT 1 FROM public.requests AS r WHERE r.id = request_id)
);

CREATE POLICY request_links_update ON public.request_links
FOR UPDATE TO authenticated
USING (public.is_agency())
WITH CHECK (public.is_agency());

CREATE POLICY request_assets_select ON public.request_assets
FOR SELECT TO authenticated
USING (public.is_agency());

CREATE POLICY request_events_select ON public.request_events
FOR SELECT TO authenticated
USING (public.is_agency());

CREATE POLICY internal_notes_select ON public.internal_notes
FOR SELECT TO authenticated
USING (public.is_agency());

CREATE POLICY internal_notes_insert ON public.internal_notes
FOR INSERT TO authenticated
WITH CHECK (public.is_agency() AND author_id = auth.uid());

CREATE POLICY ad_records_select ON public.ad_records
FOR SELECT TO authenticated
USING (public.is_agency());

CREATE POLICY channels_select ON public.channels
FOR SELECT TO authenticated
USING (public.is_agency() OR public.is_org_member(org_id));

CREATE POLICY messages_select ON public.messages
FOR SELECT TO authenticated
USING (public.is_agency() OR public.is_org_member(org_id));

CREATE POLICY message_reads_select ON public.message_reads
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_agency());

CREATE POLICY notifications_select ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY audit_logs_select ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_agency());

CREATE POLICY request_drafts_select ON public.request_drafts
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.is_org_member(org_id));

CREATE POLICY request_drafts_insert ON public.request_drafts
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

CREATE POLICY request_drafts_update ON public.request_drafts
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.is_org_member(org_id))
WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

CREATE POLICY request_drafts_delete ON public.request_drafts
FOR DELETE TO authenticated
USING (user_id = auth.uid() AND public.is_org_member(org_id));

-- Grants -------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.org_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.brand_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT SELECT, UPDATE ON public.requests TO authenticated;
GRANT SELECT, UPDATE ON public.request_links TO authenticated;
GRANT SELECT ON public.request_assets TO authenticated;
GRANT SELECT ON public.request_events TO authenticated;
GRANT SELECT, INSERT ON public.internal_notes TO authenticated;
GRANT SELECT ON public.ad_records TO authenticated;
GRANT SELECT ON public.channels TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.message_reads TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_drafts TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_agency() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_request_list(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_request_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_request_support(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_links(uuid, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_request(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_submitted_request(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_change(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_request_status(uuid, public.request_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_request_blocker(uuid, public.request_blocker, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_request_assignment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_link_checks(uuid, public.permission_method, public.permission_status, text, public.music_check, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_org_member_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_mutation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_request_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_request_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_request_draft() TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.provision_client(uuid, uuid, text, text, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_org_member(uuid, uuid, uuid, public.org_role, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, text, integer, integer) TO service_role;
