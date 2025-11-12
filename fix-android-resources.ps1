# Fix Android Resources Script
# This script regenerates the Android directory with all required resources

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bunches V6 - Android Resource Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Backing up android directory (if exists)..." -ForegroundColor Yellow
if (Test-Path "android") {
    $backupName = "android_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "  Creating backup: $backupName" -ForegroundColor Gray
    Move-Item "android" $backupName -Force
    Write-Host "  ✓ Backup created" -ForegroundColor Green
} else {
    Write-Host "  No existing android directory found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 2: Cleaning Expo cache..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item ".expo" -Recurse -Force
    Write-Host "  ✓ Expo cache cleared" -ForegroundColor Green
} else {
    Write-Host "  No cache to clear" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 3: Regenerating android directory with prebuild..." -ForegroundColor Yellow
Write-Host "  This may take a few minutes..." -ForegroundColor Gray
npx expo prebuild --platform android --clean

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Android directory regenerated successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Prebuild failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying alternative approach: install and prebuild..." -ForegroundColor Yellow
    npm install
    npx expo prebuild --platform android --clean

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Android directory regenerated successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Still failing. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 4: Verifying generated resources..." -ForegroundColor Yellow
$missingResources = @()

$requiredPaths = @(
    "android/app/src/main/res/values/strings.xml",
    "android/app/src/main/res/values/styles.xml",
    "android/app/src/main/res/mipmap-mdpi/ic_launcher.png",
    "android/app/src/main/res/mipmap-hdpi/ic_launcher.png",
    "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png"
)

foreach ($path in $requiredPaths) {
    if (Test-Path $path) {
        Write-Host "  ✓ $path" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $path (MISSING)" -ForegroundColor Red
        $missingResources += $path
    }
}

Write-Host ""
if ($missingResources.Count -eq 0) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SUCCESS! All resources generated" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now build with: cd android; .\gradlew assembleRelease" -ForegroundColor Yellow
} else {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  WARNING: Some resources still missing" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Missing resources:" -ForegroundColor Yellow
    foreach ($res in $missingResources) {
        Write-Host "  - $res" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "You may need to:" -ForegroundColor Yellow
    Write-Host "  1. Check your assets/icon.png exists and is valid" -ForegroundColor Gray
    Write-Host "  2. Check your app.json configuration" -ForegroundColor Gray
    Write-Host "  3. Run npx expo-doctor to check for issues" -ForegroundColor Gray
}

Write-Host ""
