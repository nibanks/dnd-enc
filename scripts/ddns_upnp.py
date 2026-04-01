"""
Dynamic DNS and UPnP Port Forwarding Module
Automatically updates Porkbun DNS and opens ports via UPnP when the app starts.
"""

import json
import requests
import socket
from pathlib import Path

# Try importing miniupnpc - if not available, UPnP features will be disabled
try:
    import miniupnpc
    UPNP_AVAILABLE = True
except ImportError:
    UPNP_AVAILABLE = False
    print("⚠️  miniupnpc not installed - UPnP port forwarding disabled")
    print("   Install with: pip install miniupnpc")


def get_public_ip():
    """Get the current public IP address"""
    try:
        # Use multiple services as fallbacks
        services = [
            'https://api.ipify.org',
            'https://icanhazip.com',
            'https://ifconfig.me/ip'
        ]
        
        for service in services:
            try:
                response = requests.get(service, timeout=5)
                if response.status_code == 200:
                    ip = response.text.strip()
                    print(f"✓ Public IP: {ip}")
                    return ip
            except:
                continue
        
        print("✗ Failed to get public IP from all services")
        return None
    except Exception as e:
        print(f"✗ Error getting public IP: {e}")
        return None


def get_local_ip():
    """Get the local network IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        print(f"✓ Local IP: {local_ip}")
        return local_ip
    except Exception as e:
        print(f"✗ Error getting local IP: {e}")
        return None


def setup_upnp_port_forward(external_port, internal_port=None, protocol='TCP', description='D&D Encounter Tracker'):
    """
    Set up UPnP port forwarding on the router
    
    Args:
        external_port: The external port number (what Internet sees)
        internal_port: The internal port number (what your machine uses). If None, uses external_port
        protocol: 'TCP' or 'UDP'
        description: Description for the port mapping
    
    Returns:
        bool: True if successful, False otherwise
    """
    if internal_port is None:
        internal_port = external_port
    if not UPNP_AVAILABLE:
        print("✗ UPnP not available (miniupnpc not installed)")
        return False
    
    try:
        print(f"\n🔌 Setting up UPnP port forwarding: external {external_port} -> internal {internal_port} ({protocol})...")
        
        # Create UPnP client
        upnp = miniupnpc.UPnP()
        upnp.discoverdelay = 200  # milliseconds
        
        # Discover devices
        print("  Discovering UPnP devices...")
        num_devices = upnp.discover()
        
        if num_devices == 0:
            print("✗ No UPnP devices found on network")
            return False
        
        print(f"  Found {num_devices} UPnP device(s)")
        
        # Select IGD (Internet Gateway Device)
        upnp.selectigd()
        
        # Get external IP from router
        external_ip = upnp.externalipaddress()
        print(f"  Router external IP: {external_ip}")
        
        # Get local IP
        local_ip = get_local_ip()
        if not local_ip:
            print("✗ Could not determine local IP address")
            return False
        
        # Check if port mapping already exists
        try:
            existing = upnp.getspecificportmapping(external_port, protocol)
            if existing:
                print(f"  Port {external_port}/{protocol} is already mapped")
                # Delete existing mapping to recreate it
                upnp.deleteportmapping(external_port, protocol)
                print(f"  Removed existing mapping")
        except:
            pass
        
        # Add port mapping
        # addportmapping(external_port, protocol, internal_host, internal_port, description, remote_host, lease_duration)
        result = upnp.addportmapping(
            external_port,  # external port
            protocol,       # protocol
            local_ip,       # internal host
            internal_port,  # internal port
            description,    # description
            '',             # remote host (empty = any)
            0               # lease duration (0 = indefinite)
        )
        
        if result:
            print(f"✓ Successfully opened port forwarding")
            print(f"  External: {external_ip}:{external_port} -> Internal: {local_ip}:{internal_port}")
            return True
        else:
            print(f"✗ Failed to open port {external_port}/{protocol} -> {internal_port}")
            return False
            
    except Exception as e:
        print(f"✗ UPnP error: {e}")
        return False


def update_porkbun_dns(domain, api_key, secret_key, ip_address=None, subdomain=''):
    """
    Update Porkbun DNS A record
    
    Args:
        domain: The domain name (e.g., 'nbanks.dev')
        api_key: Porkbun API key
        secret_key: Porkbun secret key
        ip_address: IP address to set (if None, will auto-detect)
        subdomain: Subdomain to update (empty string for root domain)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        print(f"\n🌐 Updating Porkbun DNS for {subdomain + '.' if subdomain else ''}{domain}...")
        
        # First, test API credentials with ping endpoint
        print(f"  Testing API credentials...")
        ping_url = 'https://api.porkbun.com/api/json/v3/ping'
        ping_payload = {
            'secretapikey': secret_key,
            'apikey': api_key
        }
        ping_response = requests.post(ping_url, json=ping_payload, timeout=10)
        if ping_response.status_code == 200:
            ping_data = ping_response.json()
            if ping_data.get('status') == 'SUCCESS':
                print(f"  ✓ API credentials validated")
                print(f"    Your IP: {ping_data.get('yourIp', 'unknown')}")
            else:
                print(f"  ✗ API ping failed: {ping_data.get('message', 'Unknown error')}")
                return False
        else:
            print(f"  ✗ API ping failed: HTTP {ping_response.status_code}")
            try:
                print(f"    Response: {ping_response.json()}")
            except:
                print(f"    Response: {ping_response.text[:200]}")
            return False
        
        # Get public IP if not provided
        if ip_address is None:
            ip_address = get_public_ip()
            if ip_address is None:
                print("✗ Could not determine public IP address")
                return False
        
        # Porkbun API endpoint
        # For root domain, use '*' as the name or check current records
        name = subdomain if subdomain else ''
        
        # First, try to get existing records
        url_retrieve = f'https://api.porkbun.com/api/json/v3/dns/retrieveByNameType/{domain}/A/{name}'
        payload = {
            'secretapikey': secret_key,
            'apikey': api_key
        }
        
        print(f"  Checking existing DNS records...")
        response = requests.post(url_retrieve, json=payload, timeout=10)
        
        record_exists = False
        record_id = None
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'SUCCESS':
                records = data.get('records', [])
                if records:
                    print(f"  Found existing A record(s): {len(records)}")
                    record_exists = True
                    record_id = records[0].get('id')
                    # Check if IP needs updating
                    current_ip = records[0].get('content')
                    if current_ip == ip_address:
                        print(f"✓ DNS already up to date: {ip_address}")
                        return True
        
        # If record exists, use edit by ID, otherwise create new
        if record_exists and record_id:
            # Edit existing record by ID
            url_update = f'https://api.porkbun.com/api/json/v3/dns/edit/{domain}/{record_id}'
            payload = {
                'secretapikey': secret_key,
                'apikey': api_key,
                'type': 'A',
                'content': ip_address,
                'ttl': '600'
            }
            if name:
                payload['name'] = name
            
            print(f"  Updating existing A record (ID: {record_id}) to {ip_address}...")
        else:
            # Create new record
            url_update = f'https://api.porkbun.com/api/json/v3/dns/create/{domain}'
            payload = {
                'secretapikey': secret_key,
                'apikey': api_key,
                'type': 'A',
                'content': ip_address,
                'ttl': '600'
            }
            if name:
                payload['name'] = name
            
            print(f"  Creating new A record: {ip_address}...")
        
        print(f"  API URL: {url_update}")
        response = requests.post(url_update, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'SUCCESS':
                print(f"✓ DNS updated successfully!")
                print(f"  {subdomain + '.' if subdomain else ''}{domain} -> {ip_address}")
                return True
            else:
                print(f"✗ DNS update failed: {data.get('message', 'Unknown error')}")
                return False
        else:
            print(f"✗ DNS update failed: HTTP {response.status_code}")
            if response.status_code == 403:
                print(f"  Possible causes:")
                print(f"  - API access not enabled for domain (check Porkbun dashboard)")
                print(f"  - Incorrect API key or secret key")
                print(f"  - Domain doesn't exist in your Porkbun account")
            try:
                error_data = response.json()
                print(f"  Response body: {json.dumps(error_data, indent=2)}")
            except:
                print(f"  Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ DNS update error: {e}")
        return False


def setup_external_access(internal_port=5000, external_port=None, credentials_file='.cache/porkbun_credentials.json'):
    """
    Complete setup for external access:
    1. Open port via UPnP
    2. Update DNS to point to current public IP
    
    Args:
        internal_port: Port number the app is running on locally
        external_port: Port number to expose externally (if None, uses internal_port)
        credentials_file: Path to Porkbun credentials JSON file
    
    Returns:
        tuple: (upnp_success, dns_success)
    """
    if external_port is None:
        external_port = internal_port
    print("\n" + "="*60)
    print("🚀 Setting up external access...")
    print("="*60)
    
    # Load credentials
    creds_path = Path(credentials_file)
    if not creds_path.exists():
        print(f"✗ Credentials file not found: {credentials_file}")
        return False, False
    
    try:
        with open(creds_path, 'r') as f:
            creds = json.load(f)
        
        api_key = creds.get('api_key')
        secret_key = creds.get('secret_key')
        domain = creds.get('domain')
        subdomain = creds.get('subdomain', '')  # Optional
        
        if not all([api_key, secret_key, domain]):
            print("✗ Missing required credentials (api_key, secret_key, domain)")
            return False, False
            
    except Exception as e:
        print(f"✗ Error loading credentials: {e}")
        return False, False
    
    # Step 1: Setup UPnP port forwarding
    upnp_success = setup_upnp_port_forward(external_port, internal_port, 'TCP', f'D&D Tracker ({domain})')
    
    # Step 2: Update DNS
    dns_success = update_porkbun_dns(domain, api_key, secret_key, subdomain=subdomain)
    
    # Summary
    print("\n" + "="*60)
    protocol = "https" if external_port == 443 else "http"
    port_display = "" if external_port in [80, 443] else f":{external_port}"
    
    if upnp_success and dns_success:
        print("✓ External access setup complete!")
        print(f"  Your app should be accessible at: {protocol}://{subdomain + '.' if subdomain else ''}{domain}{port_display}")
    elif dns_success:
        print("⚠️  DNS updated but UPnP failed")
        print(f"  You may need to manually forward port {external_port} -> {internal_port} on your router")
        print(f"  Once forwarded, your app will be at: {protocol}://{subdomain + '.' if subdomain else ''}{domain}{port_display}")
    elif upnp_success:
        print("⚠️  UPnP succeeded but DNS update failed")
        print("  Port is open but DNS may not be pointing to your IP")
    else:
        print("✗ Setup failed")
        print("  Check errors above for details")
    print("="*60 + "\n")
    
    return upnp_success, dns_success


if __name__ == '__main__':
    # Test the setup
    setup_external_access(port=5000)
