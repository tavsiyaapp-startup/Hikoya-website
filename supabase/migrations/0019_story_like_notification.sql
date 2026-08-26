-- Liking a story never notified its author — only comment likes did.
alter type notification_type add value 'story_like';
