# Test Runner Script for D&D Encounter Tracker
# This script runs both backend (pytest) and frontend (Jest) tests

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  D&D Encounter Tracker - Test Suite  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment is activated
if (-not $env:VIRTUAL_ENV) {
    Write-Host "Warning: Virtual environment not activated" -ForegroundColor Yellow
    Write-Host "Attempting to activate .venv..." -ForegroundColor Yellow
    if (Test-Path ".\.venv\Scripts\Activate.ps1") {
        & .\.venv\Scripts\Activate.ps1
    } else {
        Write-Host "Error: Virtual environment not found at .\.venv" -ForegroundColor Red
        Write-Host "Please create a virtual environment first" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Function to display test results
function Show-TestResult {
    param (
        [string]$TestName,
        [int]$ExitCode
    )
    
    if ($ExitCode -eq 0) {
        Write-Host "✓ $TestName PASSED" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $TestName FAILED" -ForegroundColor Red
        return $false
    }
}

# Track overall success
$AllTestsPassed = $true

# Run Backend Tests
Write-Host "Running Backend Tests (pytest)..." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan
pytest -v
$BackendResult = $LASTEXITCODE

Write-Host ""
$BackendPassed = Show-TestResult -TestName "Backend Tests" -ExitCode $BackendResult
$AllTestsPassed = $AllTestsPassed -and $BackendPassed
Write-Host ""

# Check if Node.js is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Warning: npm not found. Skipping frontend tests." -ForegroundColor Yellow
    Write-Host "Install Node.js to run JavaScript tests." -ForegroundColor Yellow
} else {
    # Check if node_modules exists
    if (-not (Test-Path ".\node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm install
        Write-Host ""
    }
    
    # Run Frontend Tests
    Write-Host "Running Frontend Tests (Jest)..." -ForegroundColor Cyan
    Write-Host "----------------------------------" -ForegroundColor Cyan
    npm test
    $FrontendResult = $LASTEXITCODE
    
    Write-Host ""
    $FrontendPassed = Show-TestResult -TestName "Frontend Tests" -ExitCode $FrontendResult
    $AllTestsPassed = $AllTestsPassed -and $FrontendPassed
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "           Test Summary                 " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($AllTestsPassed) {
    Write-Host "All tests passed! ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Please review the output above." -ForegroundColor Red
    exit 1
}
