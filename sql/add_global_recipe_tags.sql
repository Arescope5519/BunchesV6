-- Auto-tags on the shared global version of recipes.
-- New global recipes get high-confidence tags at creation (src/utils/autoTag.js);
-- users layer their own tags on top via user_recipes_v2.tags.
--
-- IMPORTANT: run the ALTER before installing the build that uses it -
-- the app's recipe query selects this column.

ALTER TABLE global_recipes
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- OPTIONAL BACKFILL: tag existing global recipes using the same
-- high-confidence title rules the app applies to new ones.
-- (Skips the time-based "Quick" tag - durations are too messy to parse in SQL.)
UPDATE global_recipes SET tags = array_remove(ARRAY[
  CASE WHEN title ~* '\y(soups?|stews?|chowder|bisque)\y' THEN 'Soup' END,
  CASE WHEN title ~* '\ysalads?\y' THEN 'Salad' END,
  CASE WHEN title ~* '\y(pasta|spaghetti|lasagna|fettuccine|linguine|macaroni|penne|ravioli|gnocchi|carbonara|alfredo)\y' THEN 'Pasta' END,
  CASE WHEN title ~* '\ychicken\y' THEN 'Chicken' END,
  CASE WHEN title ~* '\y(beef|steak|brisket|meatloaf)\y' THEN 'Beef' END,
  CASE WHEN title ~* '\y(pork|ham|carnitas)\y' THEN 'Pork' END,
  CASE WHEN title ~* '\y(seafood|shrimp|salmon|fish|tuna|cod|tilapia|crab|lobster|scallops?|prawns?)\y' THEN 'Seafood' END,
  CASE WHEN title ~* '\y(dessert|cakes?|cookies?|brownies?|pies?|cheesecake|cupcakes?|pudding|ice cream|tarts?|muffins?|donuts?|doughnuts?|cobbler|fudge|macarons?)\y' THEN 'Dessert' END,
  CASE WHEN title ~* '\y(breakfast|pancakes?|waffles?|oatmeal|granola|french toast|omelet?tes?|frittata|brunch)\y' THEN 'Breakfast' END,
  CASE WHEN title ~* '\y(slow[- ]cooker|crock[- ]?pot)\y' THEN 'Slow Cooker' END,
  CASE WHEN title ~* '\y(instant[- ]pot|pressure[- ]cooker)\y' THEN 'Instant Pot' END,
  CASE WHEN title ~* '\y(one[- ]pot|one[- ]pan|sheet[- ]pan)\y' THEN 'One-Pot' END
], NULL)
WHERE tags = '{}';
