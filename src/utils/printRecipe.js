/**
 * FILENAME: src/utils/printRecipe.js
 * PURPOSE: Printable recipe - builds a US Letter (8.5x11) HTML document
 * and hands it to the OS print dialog (AirPrint on iOS, print or
 * save-as-PDF on Android).
 *
 * Font size defaults to 14pt so the page is readable without glasses;
 * the user can change it in Settings (app setting `printFontSize`).
 */

import * as Print from 'expo-print';
import { loadAppSettings } from './storage';
import { APP_NAME, isInternalUrl } from '../constants/app';

export const DEFAULT_PRINT_FONT_SIZE = 14;
export const PRINT_FONT_SIZES = [12, 14, 16, 18];

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Build the printable HTML for a recipe. Expects the normalized shape
 * RecipeDetail works with: ingredients as {section: [lines]},
 * instructions as an array of steps.
 */
export const buildRecipeHTML = (recipe, fontSize = DEFAULT_PRINT_FONT_SIZE) => {
  const fs = Number(fontSize) || DEFAULT_PRINT_FONT_SIZE;

  const sections =
    recipe.ingredients && typeof recipe.ingredients === 'object' && !Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : { main: Array.isArray(recipe.ingredients) ? recipe.ingredients : [] };
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];

  const metaParts = [];
  if (recipe.prep_time) metaParts.push(`Prep: ${esc(recipe.prep_time)}`);
  if (recipe.cook_time) metaParts.push(`Cook: ${esc(recipe.cook_time)}`);
  if (recipe.total_time) metaParts.push(`Total: ${esc(recipe.total_time)}`);
  if (recipe.servings) {
    const servings = String(recipe.servings).trim();
    metaParts.push(/^(serves|yield|makes)/i.test(servings) ? esc(servings) : `Serves: ${esc(servings)}`);
  }

  const ingredientsHTML = Object.entries(sections)
    .filter(([, lines]) => Array.isArray(lines) && lines.length > 0)
    .map(([section, lines]) => {
      const heading = section !== 'main' ? `<h3>${esc(section)}</h3>` : '';
      const items = lines.map(line => `<li>${esc(line)}</li>`).join('');
      return `${heading}<ul>${items}</ul>`;
    })
    .join('');

  const instructionsHTML = instructions
    .map(step => `<li>${esc(step)}</li>`)
    .join('');

  // Web imports are owned by their source site; app-created recipes
  // credit their creator
  const sourceUrl = recipe.url || recipe.sourceUrl || recipe.source_url;
  const externalSource = sourceUrl && !isInternalUrl(sourceUrl) ? sourceUrl : null;
  const creator = recipe.createdBy?.username || recipe.ownerUsername || null;
  const sourceLine = externalSource
    ? `Source: ${esc(externalSource)}`
    : (creator ? `Created by @${esc(creator)}` : '');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; margin: 0.75in; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: ${fs}pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
  }
  h1 {
    font-size: ${Math.round(fs * 1.9)}pt;
    line-height: 1.2;
    margin: 0 0 6pt 0;
  }
  .meta {
    font-size: ${Math.max(Math.round(fs * 0.85), 10)}pt;
    color: #555555;
    margin: 0 0 4pt 0;
  }
  .rule {
    border: none;
    border-top: 2pt solid #1a1a1a;
    margin: 8pt 0 14pt 0;
  }
  h2 {
    font-size: ${Math.round(fs * 1.25)}pt;
    text-transform: uppercase;
    letter-spacing: 1pt;
    border-bottom: 1pt solid #999999;
    padding-bottom: 3pt;
    margin: 16pt 0 8pt 0;
  }
  h3 {
    font-size: ${fs}pt;
    margin: 10pt 0 4pt 0;
  }
  ul, ol { margin: 0 0 6pt 0; padding-left: 20pt; }
  li { margin-bottom: ${Math.max(Math.round(fs * 0.4), 4)}pt; }
  ol li { padding-left: 4pt; }
  .footer {
    margin-top: 18pt;
    padding-top: 6pt;
    border-top: 1pt solid #999999;
    font-size: ${Math.max(Math.round(fs * 0.75), 9)}pt;
    color: #777777;
  }
  /* Keep a step from being sliced across two pages */
  li { page-break-inside: avoid; }
</style>
</head>
<body>
  <h1>${esc(recipe.title || 'Untitled Recipe')}</h1>
  ${metaParts.length ? `<p class="meta">${metaParts.join(' &nbsp;·&nbsp; ')}</p>` : ''}
  ${sourceLine ? `<p class="meta">${sourceLine}</p>` : ''}
  <hr class="rule" />
  <h2>Ingredients</h2>
  ${ingredientsHTML || '<p>No ingredients listed.</p>'}
  <h2>Directions</h2>
  ${instructionsHTML ? `<ol>${instructionsHTML}</ol>` : '<p>No directions listed.</p>'}
  <div class="footer">Printed from ${esc(APP_NAME)}</div>
</body>
</html>`;
};

/**
 * Open the OS print dialog for a recipe. Rejects if the dialog cannot
 * open; on iOS, dismissing the dialog also rejects ("did not complete"),
 * which callers should treat as a cancel, not an error.
 */
export const printRecipe = async (recipe, { userId = null } = {}) => {
  let fontSize = DEFAULT_PRINT_FONT_SIZE;
  try {
    const settings = await loadAppSettings(userId);
    if (settings?.printFontSize) fontSize = settings.printFontSize;
  } catch {
    // Settings are a nicety - print at the default size without them
  }
  await Print.printAsync({ html: buildRecipeHTML(recipe, fontSize) });
};

export default printRecipe;
