@echo off
REM Setup Windows Firewall rule for D&D Encounter Tracker
echo Creating Windows Firewall rule...
netsh advfirewall firewall delete rule name="DnD Encounter Tracker" >nul 2>&1
netsh advfirewall firewall add rule name="DnD Encounter Tracker" dir=in action=allow protocol=TCP localport=5000 description="Allows incoming connections to D&D Encounter Tracker Flask server"
if %errorlevel% equ 0 (
    echo Success! Firewall rule created.
) else (
    echo Failed to create firewall rule. Make sure you run this as Administrator.
)
pause
