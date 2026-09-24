-- Icon avatars: the user's chosen food glyph + circle color, e.g.
-- {"name": "pizza", "color": "#2D6A4F"}. NULL = letter avatar.
--
-- Icon-only by design (no photo avatars): nothing user-uploaded to
-- moderate. The catalog of valid names/colors lives in
-- src/components/UserAvatar.js; unknown values fall back to the letter
-- avatar, so the app tolerates anything stored here.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_icon jsonb;
