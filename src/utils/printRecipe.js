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

// QR code for https://melibri.app/get - that page detects the phone and
// forwards to the right store listing (site/get.html), so printed pages
// never go stale. Generated once (qrcode npm package, EC level M) and
// embedded so printing works offline. REGENERATE if the URL ever changes.
const GET_APP_QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h25v25H0z"/><path stroke="#000000" d="M0 0.5h7m8 0h1m2 0h7M0 1.5h1m5 0h1m1 0h1m2 0h3m1 0h2m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m3 0h3m1 0h1m1 0h1m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m3 0h1m1 0h1m1 0h2m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m1 0h2m2 0h1m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m3 0h2m1 0h1m1 0h1m2 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 7.5h1m1 0h2m2 0h1M0 8.5h1m1 0h1m1 0h1m1 0h1m3 0h1m1 0h5m3 0h1m2 0h1M0 9.5h1m2 0h2m2 0h1m1 0h2m6 0h2m5 0h1M0 10.5h4m2 0h2m1 0h5m3 0h4m1 0h3M0 11.5h1m1 0h1m1 0h2m1 0h4m2 0h3m4 0h1m2 0h1M0 12.5h2m2 0h5m1 0h1m1 0h2m1 0h4m2 0h1m1 0h2M2 13.5h3m5 0h4m2 0h3m2 0h1m2 0h1M0 14.5h1m2 0h5m1 0h1m1 0h3m2 0h2m1 0h1m2 0h3M1 15.5h4m2 0h2m3 0h3m2 0h1m2 0h1m2 0h1M0 16.5h1m1 0h6m1 0h3m1 0h1m2 0h6M8 17.5h1m1 0h2m1 0h1m2 0h1m3 0h2m1 0h2M0 18.5h7m2 0h1m5 0h2m1 0h1m1 0h2m1 0h2M0 19.5h1m5 0h1m3 0h2m1 0h2m1 0h1m3 0h2m2 0h1M0 20.5h1m1 0h3m1 0h1m1 0h2m2 0h2m2 0h6m1 0h2M0 21.5h1m1 0h3m1 0h1m2 0h8m2 0h4M0 22.5h1m1 0h3m1 0h1m1 0h2m1 0h2m3 0h1m3 0h1m3 0h1M0 23.5h1m5 0h1m2 0h2m1 0h2m1 0h4m1 0h2m1 0h1M0 24.5h7m1 0h1m1 0h3m1 0h6m3 0h2"/></svg>';

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
export const buildRecipeHTML = (recipe, fontSize = DEFAULT_PRINT_FONT_SIZE, { includeImage = false } = {}) => {
  const fs = Number(fontSize) || DEFAULT_PRINT_FONT_SIZE;

  const imageUrl = includeImage
    ? (recipe.imageUrl || recipe.image_url || recipe.image || null)
    : null;

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
  .photo {
    float: right;
    width: 2.4in;
    height: 1.8in;
    object-fit: cover;
    border-radius: 6pt;
    margin: 0 0 10pt 14pt;
  }
  .footer {
    margin-top: 18pt;
    padding-top: 10pt;
    border-top: 1pt solid #999999;
    font-size: ${Math.max(Math.round(fs * 0.75), 9)}pt;
    color: #777777;
    display: flex;
    align-items: center;
  }
  .footer svg {
    width: 0.7in;
    height: 0.7in;
    margin-right: 10pt;
    flex-shrink: 0;
  }
  /* Keep a step from being sliced across two pages */
  li { page-break-inside: avoid; }
</style>
</head>
<body>
  ${imageUrl ? `<img class="photo" src="${esc(imageUrl)}" />` : ''}
  <h1>${esc(recipe.title || 'Untitled Recipe')}</h1>
  ${metaParts.length ? `<p class="meta">${metaParts.join(' &nbsp;·&nbsp; ')}</p>` : ''}
  ${sourceLine ? `<p class="meta">${sourceLine}</p>` : ''}
  <hr class="rule" />
  <h2>Ingredients</h2>
  ${ingredientsHTML || '<p>No ingredients listed.</p>'}
  <h2>Directions</h2>
  ${instructionsHTML ? `<ol>${instructionsHTML}</ol>` : '<p>No directions listed.</p>'}
  <div class="footer">
    ${GET_APP_QR_SVG}
    <div>Printed from ${esc(APP_NAME)}<br />Scan to get the app: melibri.app/get</div>
  </div>
</body>
</html>`;
};

/**
 * Open the OS print dialog for a recipe. Rejects if the dialog cannot
 * open; on iOS, dismissing the dialog also rejects ("did not complete"),
 * which callers should treat as a cancel, not an error.
 */
export const printRecipe = async (recipe, { userId = null, includeImage = false } = {}) => {
  let fontSize = DEFAULT_PRINT_FONT_SIZE;
  try {
    const settings = await loadAppSettings(userId);
    if (settings?.printFontSize) fontSize = settings.printFontSize;
  } catch {
    // Settings are a nicety - print at the default size without them
  }
  await Print.printAsync({ html: buildRecipeHTML(recipe, fontSize, { includeImage }) });
};

export default printRecipe;
