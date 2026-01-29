-- Add expires_at column to uploads table
ALTER TABLE uploads ADD COLUMN expires_at TIMESTAMPTZ;

-- Set default expiration for existing records (60 days from created_at)
UPDATE uploads SET expires_at = created_at + INTERVAL '60 days' WHERE expires_at IS NULL;

-- Create index for efficient cleanup queries
CREATE INDEX idx_uploads_expires_at ON uploads(expires_at);

-- Function to delete expired records and their storage files
-- Note: Storage cleanup must be done via API, this only cleans DB records
CREATE OR REPLACE FUNCTION cleanup_expired_uploads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired uploads (models cascade via FK)
  WITH deleted AS (
    DELETE FROM uploads
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
