const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcons() {
  const svgPath = path.join(__dirname, '../assets/icon-source.svg');
  const assetsDir = path.join(__dirname, '../assets');

  console.log('Converting SVG to PNG icons...');

  try {
    // Generate main icon (1024x1024)
    await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('✓ Generated icon.png');

    // Generate adaptive icon (1024x1024)
    await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));
    console.log('✓ Generated adaptive-icon.png');

    // Generate favicon (48x48)
    await sharp(svgPath)
      .resize(48, 48)
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));
    console.log('✓ Generated favicon.png');

    console.log('\n✓ All icons generated successfully!');
  } catch (error) {
    console.error('Error converting icons:', error);
    process.exit(1);
  }
}

convertIcons();
