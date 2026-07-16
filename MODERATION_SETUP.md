# Sightengine Content Moderation Setup

## What This Does
- When a user picks a recipe photo, it's checked by Sightengine BEFORE uploading to Supabase
- If flagged (nudity, offensive, gore, weapons), the user sees an alert and the image is rejected
- Blocked attempts get logged to a `moderation_flags` table in Supabase so you can review

## Setup Steps

### 1. Get Sightengine credentials

1. Sign up at https://sightengine.com (free tier: 500 checks/month)
2. Go to https://dashboard.sightengine.com/api-credentials
3. Copy your `API user` and `API secret`

### 2. Add credentials to the app

Edit `src/services/moderation.js`:

```javascript
const SIGHTENGINE_API_USER = 'your_api_user_here';
const SIGHTENGINE_API_SECRET = 'your_api_secret_here';
```

**Note:** Anyone with the APK can extract these credentials. For production, move this to a Supabase Edge Function that proxies the check. For now, this works fine.

### 3. Create the moderation flags table in Supabase

Run this SQL:

```sql
CREATE TABLE IF NOT EXISTS moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id TEXT,
  scores JSONB,
  reason TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'pending_review',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow inserts from authenticated users (for logging their own flags)
ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own moderation events"
ON moderation_flags FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

-- Only you (via service_role) can read/update the flags
-- Access via Supabase Dashboard -> Table Editor
```

### 4. Review flagged content

- Go to Supabase Dashboard -> Table Editor -> `moderation_flags`
- Filter by `status = 'pending_review'` to see new flags
- The `scores` column has raw Sightengine confidence values
- The `reason` column tells you why it was flagged

### 5. (Optional) Get email alerts

To get an email when someone tries to upload something flagged, set up a Supabase Database Webhook:
1. Supabase Dashboard -> Database -> Webhooks
2. Create webhook on `moderation_flags` INSERT
3. Point at a service like Resend, or a Discord webhook

## Thresholds (in `src/services/moderation.js`)

Adjust `THRESHOLDS` to make it stricter or more lenient:

```javascript
const THRESHOLDS = {
  nudity_raw: 0.5,           // Explicit nudity
  nudity_sexual: 0.3,        // Sexual activity/display
  nudity_suggestive: 0.85,   // Suggestive (high tolerance)
  offensive: 0.5,            // Offensive gestures/symbols
  gore: 0.5,                 // Gore/violence
  weapon: 0.7,               // Weapons (higher tolerance for kitchen knives)
};
```

Lower value = stricter. Higher = more lenient.

## What Happens Without Credentials

If credentials are missing, the check is SKIPPED (fail-open). You'll see a console warning:
> ⚠️ [MODERATION] Sightengine credentials not configured - skipping check

This lets you build and test the app without moderation active.

## Testing

1. Add valid Sightengine credentials
2. Build and install the app
3. Create a custom recipe and try to pick a photo
4. Console should show: `🛡️ [MODERATION] Checking image:` and `✅ [MODERATION] Image passed moderation`
5. Try a test with a known NSFW image - it should show the "Image Not Allowed" alert
