# App Roadmap

## Current State (as of writing)
- **Working name**: Hunii (tentative - final decision pre-launch)
- **Original name**: Bunches (must not use - trademark conflict with Bunches, Inc. in Class 45 social networking)
- **Repo branch**: `claude/copy-broken-branch-qQg4U`

## Origin Story
Built for developer's girlfriend who developed intracranial pressure requiring weight loss for medical reasons. Frustrated by ad-heavy recipe apps, created an ad-free health-focused alternative. Named after her nickname (honey bunches of oats → Hunii/Bunches).

## Monetization Strategy
- Free tier: Core recipe app functionality (save, share, cookbooks, social)
- Premium tier ($4.99/mo or $29.99/yr): Advanced features
- One flagship premium feature: AI recipe scanning from camera
- Health-focused positioning: dietary filters, nutrition data, meal planning
- No ads ever

## Feature Roadmap

### ✅ COMPLETED (in current build)
- Recipe CRUD with dual-write (recipes + user_recipes_v2 tables)
- Custom recipe creation with photo
- Cookbooks/folders with hierarchical support
- "My Creations" auto-folder for custom recipes
- Social features: friends, following, sharing, profiles
- Public/private recipes and profiles
- Featured recipes carousel on profiles
- Recipe import from other users (with owner-sync)
- Read-only view of other users' recipes
- Image content moderation (Sightengine + face detection)
- Text content moderation (local wordlist + OpenAI two-stage)
- User reporting with description
- User blocking with management UI
- Admin moderation queue with dismiss/delete/ban actions
- Rate limiting on reports (10/hour, 24h dedupe)
- Discord webhook for moderation notifications
- First-launch disclaimer modal
- Edge Functions for API key security
- Migration to user_recipes_v2 for all recipes

---

### 🔨 PHASE 1: Meal Planning + Grocery Lists (NEXT)
**Goal**: Build weekly meal planning tools that give users a reason to open the app every week.

**Features:**
- [ ] Meal planning calendar (weekly view)
- [ ] Drag recipes into meal slots (breakfast/lunch/dinner)
- [ ] Recipe scaling (adjust servings, ingredients update proportionally)
- [ ] Auto-generated grocery list from planned week
- [ ] Ingredient consolidation (2 cups flour + 1 cup flour = 3 cups flour)
- [ ] Grocery list check-off / shopping mode
- [ ] Save planned weeks as templates for reuse
- [ ] Share grocery list via SMS/email/link

**Tables needed:**
- `meal_plans` (user_id, week_start_date, meals JSONB)
- `grocery_lists` (user_id, name, items JSONB, from_meal_plan_id)

**Estimated time**: 2-3 sessions

---

### 🔨 PHASE 2: Dietary Filters + Recipe Tags
**Goal**: Enable filtering recipes by dietary needs (matches health-focused origin).

**Features:**
- [ ] Recipe tag system (vegetarian, vegan, gluten-free, dairy-free, keto, paleo, low-sodium, low-sugar, high-protein, etc.)
- [ ] Auto-tag recipes based on ingredient analysis
- [ ] User dietary preferences on profile
- [ ] Filter recipe list by dietary tags
- [ ] Filter search results by dietary needs
- [ ] Highlight allergens in recipes (nuts, dairy, gluten, etc.)
- [ ] Warning when recipe conflicts with user's dietary needs

**Estimated time**: 1-2 sessions

---

### 🔨 PHASE 3: Nutrition Data (Basic)
**Goal**: Approximate calorie/macro data via third-party API.

**Features:**
- [ ] Integrate with Edamam API (free tier: 5 calls/min)
- [ ] Extract nutrition per recipe (calories, protein, carbs, fat, sodium, sugar)
- [ ] Display nutrition on recipe card
- [ ] Weekly nutrition summary from meal plan
- [ ] User goal setting (daily calorie/macro targets)
- [ ] Progress toward goals
- [ ] Clear disclaimer: "Estimates only. Not medical advice."

**Third-party APIs to evaluate:**
- Edamam (free 5/min, paid $50-500/mo)
- Nutritionix (free 200/day)
- USDA FoodData Central (free, manual parsing)

**Estimated time**: 2-3 sessions

---

### 🔨 PHASE 4: Enhanced Sharing + Instagram Integration
**Goal**: Turn users into ambassadors via easy sharing to social platforms.

**Features:**
- [ ] Beautiful shareable recipe cards (auto-generated images)
- [ ] Deep links: `hunii.app/r/abc123` opens specific recipe in app
- [ ] Deep links: `hunii.app/@username` opens user profile
- [ ] "Share to Instagram Story" button (uses shareable card image)
- [ ] "Copy link for Instagram bio" button
- [ ] Instagram Story template with recipe preview
- [ ] Public recipe web page (view without app - grows viral)
- [ ] "View in app" CTA on web pages
- [ ] Pinterest board integration (save recipe as pin)

**Requires:**
- Web-side recipe rendering (simple Next.js or static)
- Deep link handling in app
- Universal Links (iOS) and App Links (Android) setup

**Estimated time**: 3-4 sessions

---

### 🔨 PHASE 5: AI Recipe Scanning ⭐ (FLAGSHIP PREMIUM FEATURE)
**Goal**: Scan any cookbook page/recipe card with camera → structured recipe in app.

**Features:**
- [ ] Camera capture UI with recipe framing guides
- [ ] Multiple photos for multi-page recipes
- [ ] Image preprocessing (deskew, enhance contrast)
- [ ] Send to Vision AI via Edge Function
- [ ] Parse response into recipe format
- [ ] Preview UI with confidence indicators
- [ ] User edits/confirms before saving
- [ ] Rate limiting: Free = 3 lifetime, Premium = 30/mo, Pro = 200/mo
- [ ] Fallback: If AI can't extract, offer manual entry with photo attached

**Tech stack:**
- Google Gemini 1.5 Flash (cheapest, ~$0.002/scan)
- Fallback to GPT-4o if Gemini fails
- Edge Function: `extract-recipe`

**Estimated time**: 2-3 sessions

---

### 🔨 PHASE 6: Subscription Infrastructure
**Goal**: Ship monetization.

**Features:**
- [ ] Subscription state tracking in Supabase
- [ ] Apple StoreKit 2 integration (iOS)
- [ ] Google Play Billing integration (Android)
- [ ] Subscription tiers: Free, Premium ($4.99/mo or $29.99/yr), Pro ($9.99/mo)
- [ ] Paywall UI when hitting premium features
- [ ] Grace period for expired subscriptions (7 days)
- [ ] Restore purchases button
- [ ] Manage subscription link (deep-link to App Store/Play Store)
- [ ] Founder pricing: first 1,000 users get $19.99 lifetime access
- [ ] "Tip jar" for beyond-subscription support

**Tables needed:**
- `subscriptions` (user_id, tier, active, expires_at, apple_txn_id, google_purchase_token)

**Estimated time**: 3-4 sessions (this is complex due to app store integrations)

---

### 🔨 PHASE 7: Launch Prep
**Goal**: Ship it.

**Tasks:**
- [ ] Finalize app name (trademark search + register)
- [ ] Design new app icon
- [ ] App store screenshots (Apple + Google)
- [ ] App store description + keywords
- [ ] Marketing website (landing page)
- [ ] Terms of Service (Termly template)
- [ ] Privacy Policy (Termly template)
- [ ] Update DisclaimerModal URLs
- [ ] Set up support email
- [ ] Sentry for error tracking
- [ ] PostHog for analytics
- [ ] Test on real iOS device
- [ ] Test on multiple Android devices
- [ ] Submit for App Store review
- [ ] Submit for Google Play review

**Estimated time**: 4-6 sessions

---

### 🔮 PHASE 8+: Post-Launch Enhancements
**Only if the app has traction:**

- **Family plans** - shared cookbooks across household members
- **Creator recipes** - power users can publish curated collections
- **Recipe versioning** - track changes over time
- **Video recipes** - short recipe videos
- **Voice control** - "Hey Hunii, next step" while cooking
- **Smart appliance integration** - Alexa, Google Home, smart ovens
- **Community challenges** - weekly meal prep challenges
- **Cooking timers** with recipe integration
- **Advanced search** - "What can I make with these 5 ingredients?"
- **Multi-language support**

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Low subscription conversion | Multi-feature bundling, annual pricing default, generous free tier |
| High churn (single feature = fast cancel) | Build multiple sticky features in phases 1-5 before pushing subscription |
| App store rejection | Follow guidelines, clear content moderation story, testers before submit |
| Infrastructure costs spike | Rate limits, feature flags, storage caps, kill switches |
| Legal (ToS/PP not ready) | Use Termly or iubenda for template docs before public launch |
| Trademark issues (Hunii) | Legal safe, practical brand collision with VTuber - accept SEO tradeoff OR pick alternative |

---

## Cost Projections
See earlier session notes. Summary:
- Infrastructure costs stay <5% of revenue at all scales
- App store fees (15-30%) are biggest cost
- Marketing is optional but limits growth
- Expected lifetime margin: 50-75%
