-- Rich event pages keep performer, venue and optional community-media metadata.
ALTER TABLE hub_events ADD COLUMN performers TEXT DEFAULT '';
ALTER TABLE hub_events ADD COLUMN venue_address TEXT DEFAULT '';
ALTER TABLE hub_events ADD COLUMN video_url TEXT DEFAULT '';
ALTER TABLE hub_events ADD COLUMN video_caption TEXT DEFAULT '';

