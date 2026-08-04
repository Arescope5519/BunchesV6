-- Recompute auto-tags on global_recipes with the corrected rules.
-- Fixes savory dishes that were wrongly tagged Dessert (shepherd's pie,
-- chicken pot pie, crab cakes...) and false friends like chicken-fried
-- steak (beef, not chicken) and beefsteak tomato (not beef).
--
-- Safe to re-run: global_recipes.tags is derived data, always recomputed
-- from the title. User tags live on user_recipes_v2 and are untouched.
--
-- Mirrors src/utils/autoTag.js. The app applies these rules to NEW
-- recipes; this statement fixes the ones already stored.

WITH normalized AS (
  SELECT
    id,
    -- rewrite phrases where a category word means a different food
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
      title,
      '\ychicken[-[:space:]]?fried steak\y', ' steak ', 'gi'),
      '\ychicken of the woods\y',            ' mushroom ', 'gi'),
      '\y(lobster|oyster) mushrooms?\y',     ' mushroom ', 'gi'),
      '\ybeef ?steak tomato(es)?\y',         ' tomato ', 'gi'),
      '\ycrab ?apples?\y',                   ' apple ', 'gi'),
      '\y(swedish fish|goldfish)\y',         ' candy ', 'gi'
    ) AS t
  FROM global_recipes
),
scored AS (
  SELECT
    id,
    t,
    -- strip savory borrowings before testing for dessert words
    regexp_replace(
      t,
      '\y((pot|shepherd.?s|cottage|pizza|meat|tamale|frito|cheeseburger|tomato|chicken|beef|turkey) pies?'
      '|(crab|fish|salmon|tuna|corn|potato|rice|hoe|johnny) ?cakes?'
      '|(yorkshire|corn|black|blood) pudding'
      '|(tomato|onion|savou?ry|spinach|mushroom) tarts?'
      '|(corn|english|savou?ry) muffins?)\y',
      ' ', 'gi'
    ) AS dessert_text,
    (t ~* '\y(soups?|stews?|chowder|bisque)\y'
     OR t ~* '\ysalads?\y'
     OR t ~* '\y(pasta|spaghetti|lasagna|fettuccine|linguine|macaroni|penne|ravioli|gnocchi|carbonara|alfredo)\y'
     OR t ~* '\ychicken\y'
     OR t ~* '\y(beef|steak|brisket|meatloaf)\y'
     OR t ~* '\y(pork|ham|carnitas)\y'
     OR t ~* '\y(seafood|shrimp|salmon|fish|tuna|cod|tilapia|crab|lobster|scallops?|prawns?)\y'
    ) AS is_savory
  FROM normalized
)
UPDATE global_recipes g
SET tags = array_remove(ARRAY[
  CASE WHEN s.t ~* '\y(soups?|stews?|chowder|bisque)\y' THEN 'Soup' END,
  CASE WHEN s.t ~* '\ysalads?\y' THEN 'Salad' END,
  CASE WHEN s.t ~* '\y(pasta|spaghetti|lasagna|fettuccine|linguine|macaroni|penne|ravioli|gnocchi|carbonara|alfredo)\y' THEN 'Pasta' END,
  CASE WHEN s.t ~* '\ychicken\y' THEN 'Chicken' END,
  CASE WHEN s.t ~* '\y(beef|steak|brisket|meatloaf)\y' THEN 'Beef' END,
  CASE WHEN s.t ~* '\y(pork|ham|carnitas)\y' THEN 'Pork' END,
  CASE WHEN s.t ~* '\y(seafood|shrimp|salmon|fish|tuna|cod|tilapia|crab|lobster|scallops?|prawns?)\y' THEN 'Seafood' END,
  -- Dessert only when nothing savory matched
  CASE WHEN NOT s.is_savory AND s.dessert_text ~* '\y(dessert|cakes?|cookies?|brownies?|pies?|cheesecake|cupcakes?|pudding|ice cream|tarts?|muffins?|donuts?|doughnuts?|cobbler|fudge|macarons?)\y' THEN 'Dessert' END,
  CASE WHEN s.t ~* '\y(breakfast|pancakes?|waffles?|oatmeal|granola|french toast|omelet?tes?|frittata|brunch)\y' THEN 'Breakfast' END,
  CASE WHEN s.t ~* '\y(slow[- ]cooker|crock[- ]?pot)\y' THEN 'Slow Cooker' END,
  CASE WHEN s.t ~* '\y(instant[- ]pot|pressure[- ]cooker)\y' THEN 'Instant Pot' END,
  CASE WHEN s.t ~* '\y(one[- ]pot|one[- ]pan|sheet[- ]pan)\y' THEN 'One-Pot' END
], NULL)
FROM scored s
WHERE g.id = s.id;
