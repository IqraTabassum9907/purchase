-- Run this once in the Supabase SQL editor.
-- Adds the "Delegate for Approval" stage: lets Create Indent hand pending
-- indents off to one or more approvers (existing login users), and lets
-- Indent Approval show a tab per approver for their delegated items.

CREATE TABLE IF NOT EXISTS public.indent_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indent_id uuid NOT NULL REFERENCES public.indents(id) ON DELETE CASCADE,
  approver_username text NOT NULL,
  approver_name text,
  delegated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS indent_delegations_indent_id_idx ON public.indent_delegations (indent_id);
CREATE INDEX IF NOT EXISTS indent_delegations_approver_idx ON public.indent_delegations (approver_username);

-- Optional but recommended: prevent delegating the same indent to the same
-- approver twice (the app also de-dupes client-side before inserting).
CREATE UNIQUE INDEX IF NOT EXISTS indent_delegations_unique_pair
  ON public.indent_delegations (indent_id, approver_username);

-- Note: this project's other tables (indents, indent_approvals, etc.) are
-- queried directly from the browser with the anon key and have no RLS
-- policies defined in this repo, so this new table intentionally follows
-- the same pattern. If your project enforces RLS by default, add matching
-- policies here before going live.
