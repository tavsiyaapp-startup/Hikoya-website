-- Only the author may delete their own story — administration can only
-- hide it (set it back to draft with a reason, exactly like a moderator
-- rejecting a pending submission, just applied to an already-published
-- story instead). Nothing in the app ever exercised the is_staff() branch
-- of the delete policy before now (no delete UI existed for either side),
-- so this is a pure tightening, not a behavior change for anything shipped.
drop policy "authors delete their own stories" on stories;
create policy "authors delete their own stories" on stories for delete using (author_id = auth.uid());

-- Distinct from 'story_rejected' so the author isn't told their brand-new
-- submission was rejected when what actually happened is staff pulled an
-- already-live story back down.
alter type notification_type add value 'story_hidden';
