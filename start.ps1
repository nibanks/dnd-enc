# D&D Encounter Tracker - Server Startup Script
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "Starting D&D Encounter Tracker..." -ForegroundColor Green
Write-Host "Server will be available at http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
python app.py
