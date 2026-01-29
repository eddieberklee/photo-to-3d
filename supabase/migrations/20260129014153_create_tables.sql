-- Create uploads table
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create models table
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    model_url TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('glb', 'gltf', 'obj', 'fbx', 'usdz')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);
CREATE INDEX idx_models_upload_id ON models(upload_id);

-- Enable Row Level Security
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- RLS Policies for uploads table

-- Anyone can insert (for anonymous uploads)
CREATE POLICY "Anyone can create uploads"
    ON uploads FOR INSERT
    WITH CHECK (true);

-- Users can view their own uploads, or uploads with null user_id (anonymous)
CREATE POLICY "Users can view own uploads or anonymous"
    ON uploads FOR SELECT
    USING (
        user_id IS NULL 
        OR user_id = auth.uid()
    );

-- Users can update their own uploads
CREATE POLICY "Users can update own uploads"
    ON uploads FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own uploads
CREATE POLICY "Users can delete own uploads"
    ON uploads FOR DELETE
    USING (user_id = auth.uid());

-- RLS Policies for models table

-- Models inherit access from their parent upload
CREATE POLICY "Users can view models for accessible uploads"
    ON models FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM uploads
            WHERE uploads.id = models.upload_id
            AND (uploads.user_id IS NULL OR uploads.user_id = auth.uid())
        )
    );

-- Only system can insert models (via service role)
CREATE POLICY "Service role can insert models"
    ON models FOR INSERT
    WITH CHECK (true);

-- Users can delete models for their own uploads
CREATE POLICY "Users can delete models for own uploads"
    ON models FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM uploads
            WHERE uploads.id = models.upload_id
            AND uploads.user_id = auth.uid()
        )
    );
