-- Adds per-source diagnostics so the "Event source health" panel can explain WHY a source shows
-- zero events (page had no event data, every listing was screened out, and so on).
ALTER TABLE source_status ADD COLUMN raw_count INTEGER;
ALTER TABLE source_status ADD COLUMN rejected_count INTEGER;
ALTER TABLE source_status ADD COLUMN links_followed INTEGER;
ALTER TABLE source_status ADD COLUMN sample_rejected TEXT;
ALTER TABLE source_status ADD COLUMN note TEXT;
