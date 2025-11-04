# App Icon Setup Instructions

I've created a stylized "B" icon in `icon-source.svg` with:
- Elegant script font style
- Honey gold (#DAA520) gradient
- Black (#1a1a1a) background
- Decorative flourishes

## Option 1: Online Conversion (Easiest)

1. Go to https://cloudconvert.com/svg-to-png
2. Upload `assets/icon-source.svg`
3. Set dimensions to **1024x1024**
4. Convert and download as `icon.png`
5. Copy the downloaded file to replace `assets/icon.png`
6. Copy it again as `assets/adaptive-icon.png`
7. Create a 48x48 version for `assets/favicon.png`

## Option 2: Using ImageMagick (Command Line)

```bash
cd /home/user/BunchesV6/assets

# Convert to 1024x1024 PNG
magick icon-source.svg -resize 1024x1024 icon.png
cp icon.png adaptive-icon.png

# Create favicon
magick icon-source.svg -resize 48x48 favicon.png
```

## Option 3: Using Inkscape

```bash
cd /home/user/BunchesV6/assets

# Export as PNG
inkscape icon-source.svg --export-filename=icon.png --export-width=1024 --export-height=1024
cp icon.png adaptive-icon.png

# Create favicon
inkscape icon-source.svg --export-filename=favicon.png --export-width=48 --export-height=48
```

## After Conversion

1. **Clear cache and rebuild**:
   ```bash
   cd /home/user/BunchesV6
   expo start -c
   ```

2. **For Android**: The app icon will update on next build
3. **For iOS**: You may need to rebuild the app

## Files to Replace

- `assets/icon.png` (1024x1024) - Main app icon
- `assets/adaptive-icon.png` (1024x1024) - Android adaptive icon
- `assets/favicon.png` (48x48) - Web favicon

The icon features:
- Honey gold script "B" with gradient (light gold → honey gold → dark gold)
- Black rounded rectangle background
- Decorative flourishes at top and bottom
- Subtle shadow and shine effects
- Matches your app's honey gold theme!
