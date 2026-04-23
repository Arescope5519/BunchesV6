# Development Changelog

Base version: 0.0.2 (stable Android build)

## Changes

### Fix: Ingredient count showing "1" on preview screen
- **Issue**: Ingredient count in preview stats always showed "1" regardless of actual count
- **Root cause**: `SaveRecipeScreen` didn't normalize ingredients format - if sections contained strings instead of arrays, `Object.values().flat().length` counted sections not items
- **File**: `src/screens/SaveRecipeScreen.js`
- **Fix**: Added `normalizeIngredients()` helper that converts all ingredient formats to `{ section: [items] }` structure; updated count calculation to properly sum across sections
- **Status**: Complete
