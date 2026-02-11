# D&D Encounter Tracker - Server Startup Script
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Check for firewall rule
$firewallCheck = netsh advfirewall firewall show rule name="DnD Encounter Tracker" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "FIRST TIME SETUP REQUIRED" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To allow network access (for spectator view), you need to:" -ForegroundColor Cyan
    Write-Host "1. Right-click 'setup-firewall.bat'" -ForegroundColor White
    Write-Host "2. Select 'Run as administrator'" -ForegroundColor White
    Write-Host "3. Come back here and run start.ps1 again" -ForegroundColor White
    Write-Host ""
    Write-Host "Or to do it manually:" -ForegroundColor Cyan
    Write-Host "netsh advfirewall firewall add rule name=`"DnD Encounter Tracker`" dir=in action=allow protocol=TCP localport=5000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press any key to continue anyway (localhost only)..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host ""
Write-Host "Starting D&D Encounter Tracker..." -ForegroundColor Green

# Get local IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -First 1).IPAddress

Write-Host "Server will be available at:" -ForegroundColor Cyan
Write-Host "  Local:     http://127.0.0.1:5000" -ForegroundColor Cyan
if ($localIP) {
    Write-Host "  Network:   http://${localIP}:5000" -ForegroundColor Green
    Write-Host "  Spectator: http://${localIP}:5000/spectator" -ForegroundColor Magenta
}
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python app.py
