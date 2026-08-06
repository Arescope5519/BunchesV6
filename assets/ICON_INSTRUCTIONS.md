# App Icon

The mark is a white **M** on the Honey + Forest primary green
(`#2D6A4F`, `colors.primary`), set in YoungSerif. It deliberately matches
`src/components/LetterPlaceholder.js` so the launcher icon and the
in-app letter tiles for photo-less recipes read as the same family.

This is a placeholder mark, not final artwork - it exists so the app
stops shipping the old "B". Replace it before launch.

## Regenerating

Everything is generated from one script, so the mark can never drift
between the four assets:

```bash
pip3 install pillow
python3 assets/generate-icons.py
```

It writes:

| File | Size | Notes |
|---|---|---|
| `icon.png` | 1024x1024 | iOS + legacy Android. Flat square, **no alpha** - iOS rejects icons with an alpha channel, and the OS applies its own rounding. |
| `adaptive-icon.png` | 1024x1024 | Android foreground layer only, transparent. The green comes from `android.adaptiveIcon.backgroundColor` in `app.json`. |
| `splash.png` | 1024x1024 | Rounded green tile on transparent, sits on the white splash background. |
| `favicon.png` | 48x48 | Web. |

## Android safe zone

Android crops the adaptive icon to the centre **66.7%** before applying
its mask (circle, squircle, teardrop, ...), so the glyph is drawn at 38%
of the canvas height rather than the 56% used for iOS. Those two numbers
look different but land in the same place optically once the crop is
applied. If you change one, re-check the other.

## After changing any icon

Android caches launcher icons aggressively. A rebuild alone often is not
enough - uninstall the old APK first, or the old icon can persist.

```cmd
adb uninstall app.melibri
```

Then rebuild as normal.
