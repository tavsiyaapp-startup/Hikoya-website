-- New stories/chapters were going straight to status = 'published' on
-- creation — nothing stopped them from being publicly visible instantly.
-- Adds a 'pending_review' state to both status enums so createStory/
-- addChapter can route new content through admin approval instead, and
-- flips platform_settings.new_story_requires_review on (it already existed
-- as an inert admin Settings toggle with no code reading it).

alter type story_status add value if not exists 'pending_review';
alter type chapter_status add value if not exists 'pending_review';

update platform_settings set new_story_requires_review = true where id = 1;
