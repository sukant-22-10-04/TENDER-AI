-- Add ranking-related columns to bids table
ALTER TABLE bids
  ADD COLUMN placement INTEGER;

ALTER TABLE bids
  ADD COLUMN rank_label TEXT;

ALTER TABLE bids
  ADD COLUMN composite_score NUMERIC;

-- Optional: store simple file metadata (if you'd like to keep uploaded file info)
ALTER TABLE bids
  ADD COLUMN file_meta JSONB;
