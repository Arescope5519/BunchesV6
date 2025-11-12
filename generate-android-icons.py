#!/usr/bin/env python3
"""
Generate Android icon resources from assets/icon.png
Creates all required mipmap densities for native Android builds
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: Pillow is required. Install with:")
    print("  pip install Pillow")
    sys.exit(1)


def create_round_icon(square_image):
    """Create a rounded version of the icon"""
    size = square_image.size
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)

    rounded = Image.new('RGBA', size, (0, 0, 0, 0))
    rounded.paste(square_image, (0, 0))
    rounded.putalpha(mask)
    return rounded


def generate_icons(source_icon_path, output_base_path):
    """Generate all Android icon densities"""

    # Icon sizes for each density
    densities = {
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192
    }

    print(f"Loading source icon: {source_icon_path}")
    try:
        source_img = Image.open(source_icon_path)
        # Convert to RGBA if needed
        if source_img.mode != 'RGBA':
            source_img = source_img.convert('RGBA')
    except Exception as e:
        print(f"ERROR: Could not load {source_icon_path}: {e}")
        return False

    print(f"Source icon size: {source_img.size}")
    print()

    for density, size in densities.items():
        mipmap_dir = output_base_path / f'mipmap-{density}'
        mipmap_dir.mkdir(parents=True, exist_ok=True)

        # Generate square icon
        square_resized = source_img.resize((size, size), Image.Resampling.LANCZOS)
        square_path = mipmap_dir / 'ic_launcher.png'
        square_resized.save(square_path, 'PNG')
        print(f"✓ Created {square_path} ({size}x{size})")

        # Generate round icon
        round_resized = create_round_icon(square_resized)
        round_path = mipmap_dir / 'ic_launcher_round.png'
        round_resized.save(round_path, 'PNG')
        print(f"✓ Created {round_path} ({size}x{size})")

    print()
    print("SUCCESS! All Android icons generated.")
    return True


def copy_xml_resources(source_dir, dest_dir):
    """Copy XML resource files"""
    import shutil

    xml_files = [
        ('values/strings.xml', 'values'),
        ('values/styles.xml', 'values'),
        ('values/colors.xml', 'values'),
        ('drawable/splashscreen.xml', 'drawable'),
    ]

    print("\nCopying XML resources...")
    for file_path, subdir in xml_files:
        src = source_dir / file_path
        dest_dir_path = dest_dir / subdir
        dest_dir_path.mkdir(parents=True, exist_ok=True)
        dest = dest_dir_path / Path(file_path).name

        if src.exists():
            shutil.copy2(src, dest)
            print(f"✓ Copied {dest}")
        else:
            print(f"✗ Source not found: {src}")

    print()


def main():
    # Paths
    project_root = Path(__file__).parent
    source_icon = project_root / 'assets' / 'icon.png'
    android_res = project_root / 'android' / 'app' / 'src' / 'main' / 'res'
    manual_fix_dir = project_root / 'android-resources-manual-fix'

    print("=" * 60)
    print("  Android Icon & Resource Generator")
    print("=" * 60)
    print()

    # Check if source icon exists
    if not source_icon.exists():
        print(f"ERROR: Source icon not found at {source_icon}")
        sys.exit(1)

    # Check if android directory exists
    if not android_res.exists():
        print(f"ERROR: Android res directory not found at {android_res}")
        print()
        print("Please ensure you have an android/ directory in your project.")
        print("You may need to run: npx react-native init or similar")
        sys.exit(1)

    # Generate icons
    success = generate_icons(source_icon, android_res)

    if not success:
        sys.exit(1)

    # Copy XML resources
    if manual_fix_dir.exists():
        copy_xml_resources(manual_fix_dir, android_res)
    else:
        print("Note: android-resources-manual-fix directory not found.")
        print("XML resources (strings.xml, styles.xml, etc.) not copied.")

    print("=" * 60)
    print("  COMPLETE!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. cd android")
    print("  2. .\\gradlew clean")
    print("  3. .\\gradlew assembleRelease")
    print()


if __name__ == '__main__':
    main()
