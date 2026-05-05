-- SQL Migration: Add profile fields for featured recipes and followers
-- Run this in the Supabase SQL editor

-- Add new columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS featured_recipes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Create followers table for tracking follow relationships
CREATE TABLE IF NOT EXISTS user_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_followers_follower ON user_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON user_followers(following_id);

-- Enable RLS on followers table
ALTER TABLE user_followers ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can see their own follow relationships and public users' followers
CREATE POLICY "Users can view their own follows" ON user_followers
  FOR SELECT
  USING (
    auth.uid() = follower_id
    OR auth.uid() = following_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = following_id
      AND is_public = true
    )
  );

-- RLS policy: Users can follow/unfollow others
CREATE POLICY "Users can manage their own follows" ON user_followers
  FOR ALL
  USING (auth.uid() = follower_id);

-- Function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for the person being followed
    UPDATE user_profiles
    SET follower_count = COALESCE(follower_count, 0) + 1
    WHERE user_id = NEW.following_id;

    -- Increment following count for the follower
    UPDATE user_profiles
    SET following_count = COALESCE(following_count, 0) + 1
    WHERE user_id = NEW.follower_id;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count
    UPDATE user_profiles
    SET follower_count = GREATEST(COALESCE(follower_count, 0) - 1, 0)
    WHERE user_id = OLD.following_id;

    -- Decrement following count
    UPDATE user_profiles
    SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
    WHERE user_id = OLD.follower_id;

    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_follow_change ON user_followers;
CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON user_followers
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Grant permissions
GRANT SELECT ON user_followers TO authenticated;
GRANT INSERT, DELETE ON user_followers TO authenticated;
