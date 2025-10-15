# BunchesV6 - Setup Modular Structure Script
# Run this in your BunchesV6 root directory

Write-Host "Setting up BunchesV6 modular structure..." -ForegroundColor Cyan

# Create main src directory
Write-Host "Creating src/ directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "src" | Out-Null

# Create subdirectories
Write-Host "Creating subdirectories..." -ForegroundColor Yellow
$directories = @(
    "src\constants",
    "src\utils",
    "src\hooks",
    "src\components",
    "src\screens"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "  Created: $dir" -ForegroundColor Green
}

# Backup current App.js if it exists
if (Test-Path "App.js") {
    Write-Host "Backing up current App.js..." -ForegroundColor Yellow
    Copy-Item "App.js" "App.js.backup" -Force
    Write-Host "  Backup created: App.js.backup" -ForegroundColor Green
}

# Create .gitkeep files to preserve empty directories in git
Write-Host "Creating .gitkeep files..." -ForegroundColor Yellow
foreach ($dir in $directories) {
    New-Item -ItemType File -Force -Path "$dir\.gitkeep" | Out-Null
}

Write-Host ""
Write-Host "Folder structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Your structure:" -ForegroundColor Cyan
Write-Host "BunchesV6/"
Write-Host "  App.js (backed up to App.js.backup)"
Write-Host "  RecipeExtractor.js"
Write-Host "  src/"
Write-Host "    constants/     (colors, styles)"
Write-Host "    utils/         (helpers, storage)"
Write-Host "    hooks/         (custom hooks)"
Write-Host "    components/    (UI components)"
Write-Host "    screens/       (screen components)"
Write-Host ""
Write-Host "Next step: Paste your App.js content and I will break it down!" -ForegroundColor Cyan