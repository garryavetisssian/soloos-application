-- Capture the channel a saved cover letter was written for, plus the
-- recipient name when known. The generator now branches on these — a
-- "direct" channel produces a much shorter, conversational DM that
-- addresses the recipient by first name; "platform" keeps the formal
-- cover-letter behaviour. Idempotent — safe to re-run.

alter table public.saved_cover_letters
  add column if not exists channel text
    check (channel in ('platform', 'direct')),
  add column if not exists recipient_name text;

-- RLS policy (saved_cover_letters_owner_all) already covers SELECT /
-- INSERT / UPDATE / DELETE for the new columns; nothing to add.
