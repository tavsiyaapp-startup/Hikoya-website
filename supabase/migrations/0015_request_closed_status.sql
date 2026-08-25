-- Adds a "closed" terminal status for requests, distinct from "fulfilled":
-- a request can be closed by its author (or staff) without ever having a
-- story attached — "fulfilled" stays reserved for a genuinely completed
-- request. Closing stops new responses but existing request_responses rows
-- (and any story they link to) remain untouched and visible.

alter type request_status add value 'closed';
