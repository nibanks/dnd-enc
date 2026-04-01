# D&D Beyond Cookie Setup Helper
# This script helps you set up D&D Beyond cookies for the test suite

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  D&D Beyond Cookie Setup Helper" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "To use D&D Beyond features and run integration tests, you need to provide" -ForegroundColor Yellow
Write-Host "authentication cookies from your browser.`n" -ForegroundColor Yellow

Write-Host "Step 1: Get Your Cookies from Browser" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host "1. Open your browser and go to: " -NoNewline
Write-Host "https://www.dndbeyond.com" -ForegroundColor Cyan
Write-Host "2. Make sure you're logged in"
Write-Host "3. Press F12 to open Developer Tools"
Write-Host "4. Go to the 'Application' tab (Chrome) or 'Storage' tab (Firefox)"
Write-Host "5. In the left sidebar, expand 'Cookies' and click on 'https://www.dndbeyond.com'"
Write-Host "6. Find and copy the values for these three cookies:"
Write-Host "   - CobaltId" -ForegroundColor Yellow
Write-Host "   - CobaltAff" -ForegroundColor Yellow
Write-Host "   - CobaltAT" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to continue
$continue = Read-Host "Do you have your cookies ready? (y/n)"
if ($continue -ne 'y' -and $continue -ne 'Y') {
    Write-Host "`nNo problem! Run this script again when you're ready." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nStep 2: Enter Your Cookies" -ForegroundColor Green
Write-Host "--------------------------" -ForegroundColor Green

# Get cookies from user
Write-Host "`nEnter CobaltId value: " -ForegroundColor Yellow -NoNewline
$cobaltId = Read-Host

Write-Host "Enter CobaltAff value: " -ForegroundColor Yellow -NoNewline
$cobaltAff = Read-Host

Write-Host "Enter CobaltAT value: " -ForegroundColor Yellow -NoNewline
$cobaltAT = Read-Host

# Validate input
if ([string]::IsNullOrWhiteSpace($cobaltId) -or 
    [string]::IsNullOrWhiteSpace($cobaltAff) -or 
    [string]::IsNullOrWhiteSpace($cobaltAT)) {
    Write-Host "`nError: All three cookie values are required!" -ForegroundColor Red
    exit 1
}

# Create cookies object
$cookies = @{
    "CobaltId" = $cobaltId.Trim()
    "CobaltAff" = $cobaltAff.Trim()
    "CobaltAT" = $cobaltAT.Trim()
}

# Ensure .cache directory exists
if (-not (Test-Path ".cache")) {
    New-Item -ItemType Directory -Path ".cache" | Out-Null
    Write-Host "`nCreated .cache directory" -ForegroundColor Gray
}

# Save to cookies.json
$cookiesJson = $cookies | ConvertTo-Json -Depth 10
$cookiesJson | Out-File ".cache/cookies.json" -Encoding UTF8

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Success! Cookies Saved" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Cookies have been saved to: " -NoNewline
Write-Host ".cache/cookies.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now:" -ForegroundColor Yellow
Write-Host "  1. Run the production app with D&D Beyond integration" -ForegroundColor White
Write-Host "  2. Run integration tests with: " -NoNewline -ForegroundColor White
Write-Host "pytest" -ForegroundColor Cyan
Write-Host "  3. D&D Beyond API tests will no longer be skipped" -ForegroundColor White
Write-Host ""
Write-Host "Tip: " -NoNewline -ForegroundColor Yellow
Write-Host "If your cookies expire, just run this script again!" -ForegroundColor Gray
Write-Host ""
