-- Run with: supabase test db
-- These checks impersonate authenticated users. The postgres role used by the
-- test runner bypasses RLS, so the role switch below is required.

BEGIN;
SELECT plan(8);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'client-a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Client A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'client-b@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Client B"}', now(), now(), '', '', '', '');

INSERT INTO public.organizations (id, name, slug, request_prefix)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Client A', 'client-a', 'CAA'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Client B', 'client-b', 'CBB');

INSERT INTO public.org_members (org_id, user_id, role)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'client_owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'client_owner');

INSERT INTO public.requests (
  id, org_id, request_number, title, status, submitted_by, first_response_due_at
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'CAA-0001',
  'Secret request',
  'submitted',
  '11111111-1111-4111-8111-111111111111',
  now()
);

INSERT INTO public.internal_notes (org_id, request_id, author_id, body)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111',
  'Staff only'
);

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is_empty(
  $$SELECT id FROM public.requests WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  'Client B cannot read Client A requests'
);

SELECT is_empty(
  $$SELECT id FROM public.internal_notes$$,
  'A client cannot read internal notes'
);

SELECT is_empty(
  $$UPDATE public.requests SET status = 'live' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' RETURNING id$$,
  'A client cannot change another client request'
);

SELECT throws_ok(
  $$SELECT public.change_request_status('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'live', NULL)$$,
  'P0001',
  'not_allowed',
  'A client cannot change status through the agency function'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET platform_role = 'super_admin' WHERE id = auth.uid()$$,
  '42501',
  NULL,
  'A client has no privilege to update profiles directly'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT ok(
  (SELECT public.client_request_detail('cccccccc-cccc-4ccc-8ccc-cccccccccccc')::text NOT LIKE '%staff_only_check_notes%'),
  'Client detail omits staff-only columns'
);

SELECT ok(
  (SELECT public.client_request_detail('cccccccc-cccc-4ccc-8ccc-cccccccccccc')::text NOT LIKE '%assigned_to%'),
  'Client detail omits assignment'
);

RESET ROLE;
UPDATE public.profiles SET is_active = false WHERE id = '11111111-1111-4111-8111-111111111111';
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.client_request_detail('cccccccc-cccc-4ccc-8ccc-cccccccccccc') IS NULL,
  'A disabled user loses access to client data'
);

SELECT * FROM finish();
ROLLBACK;
