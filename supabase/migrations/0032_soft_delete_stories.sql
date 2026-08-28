-- Author "delete" becomes a soft delete (status -> 'draft', deleted_at set)
-- instead of a real row DELETE, so admin can restore it into the author's
-- drafts or destroy it for good from the trash. See changelog for the full
-- design (why deleted_at is readable, why status flips too).
alter table stories add column deleted_at timestamptz;
create index stories_deleted_at_idx on stories (deleted_at) where deleted_at is not null;

-- No one gets a client-side hard DELETE on stories anymore — soft-delete is
-- a plain UPDATE (already covered by "authors update their own stories"),
-- and permanent delete only ever happens from the admin trash via the
-- service-role client. Leaving this policy active would let an author
-- bypass the trash entirely with a raw DELETE call from their own session.
drop policy "authors delete their own stories" on stories;

-- Once deleted, a story becomes readable by anyone (title/cover/etc — not
-- its content, chapters stay gated on the story's own status via the
-- chapters policy) so a reader who already saved/collected it can still see
-- its title for the "«Название» удалено" placeholder instead of the row
-- just vanishing from their collection/library. Nothing lists, searches, or
-- browses by deleted_at, so this never surfaces it anywhere on its own —
-- same "technically fetchable, never listed" precedent 'unlisted'
-- visibility already relies on. Direct navigation to the story/chapter/
-- manage pages is separately blocked at the app layer (getStoryBySlug
-- treats deleted_at as not-found for everyone, author included).
drop policy "published public stories are readable" on stories;
create policy "published public stories are readable" on stories for select using (
  (status = 'published' and visibility in ('public', 'unlisted'))
  or author_id = auth.uid()
  or is_staff()
  or deleted_at is not null
);

-- Sent to the author when staff restores their story out of the trash.
alter type notification_type add value 'story_restored';
