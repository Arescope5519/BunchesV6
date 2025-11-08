const sharp = require('sharp');
const path = require('path');

async function generateFavicon() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const faviconPath = path.join(__dirname, '../assets/favicon.png');

  console.log('Generating favicon from icon.png...');

  try {
    await sharp(iconPath)
      .resize(48, 48)
      .png()
      .toFile(faviconPath);

    console.log('✓ Generated favicon.png (48x48)');
  } catch (error) {
    console.error('Error generating favicon:', error);
    process.exit(1);
  }
}

generateFavicon();
