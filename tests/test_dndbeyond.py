"""
Tests for D&D Beyond integration endpoints.
"""
import json
import pytest
import os
from pathlib import Path


class TestDndBeyondCookies:
    """Tests for D&D Beyond cookie management."""
    
    def test_set_cookies_success(self, client, app):
        """Test setting D&D Beyond cookies."""
        cookies = {
            'CobaltId': 'test_cobalt_id',
            'CobaltAff': 'test_cobalt_aff',
            'CobaltAT': 'test_cobalt_at'
        }
        
        response = client.post(
            '/api/dndbeyond/set-cookies',
            data=json.dumps({'cookies': cookies}),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        
        # Verify cookies were saved
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        assert cookie_file.exists()
        
        saved_cookies = json.loads(cookie_file.read_text())
        assert saved_cookies['CobaltId'] == 'test_cobalt_id'
    
    def test_clear_cookies(self, client, app):
        """Test clearing D&D Beyond cookies."""
        # First set cookies
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        cookie_file.write_text(json.dumps({'CobaltId': 'test'}))
        
        response = client.post('/api/dndbeyond/clear-cookies')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        
        # Verify cookies were deleted
        assert not cookie_file.exists()
    
    def test_cookie_status_configured(self, client, app):
        """Test checking cookie status when configured."""
        # Use the API to set cookies (which updates the global DNDBEYOND_COOKIES)
        cookies = {
            'CobaltId': 'test',
            'CobaltAff': 'test',
            'CobaltAT': 'test'
        }
        client.post(
            '/api/dndbeyond/set-cookies',
            data=json.dumps({'cookies': cookies}),
            content_type='application/json'
        )
        
        response = client.get('/api/dndbeyond/cookie-status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['hasCookies'] is True
    
    def test_cookie_status_not_configured(self, client, app):
        """Test checking cookie status when not configured."""
        # Ensure cookies are cleared first
        import app as flask_app
        flask_app.DNDBEYOND_COOKIES = {}
        
        response = client.get('/api/dndbeyond/cookie-status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['hasCookies'] is False


@pytest.mark.dndbeyond
class TestDndBeyondMonsters:
    """Tests for D&D Beyond monster fetching (requires real API access)."""
    
    def test_fetch_monsters_list(self, client, app, dndbeyond_cookies, skip_if_no_dndbeyond):
        """Test fetching the monster list from D&D Beyond."""
        # Set cookies first
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        cookie_file.write_text(json.dumps(dndbeyond_cookies))
        
        response = client.get('/api/dndbeyond/monsters')
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Should return a list of monsters
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify cache was created
        cache_file = CACHE_DIR / 'monsters.json'
        assert cache_file.exists()
    
    def test_fetch_monster_details(self, client, app, dndbeyond_cookies, skip_if_no_dndbeyond):
        """Test fetching specific monster details from D&D Beyond."""
        # Set cookies first
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        cookie_file.write_text(json.dumps(dndbeyond_cookies))
        
        # Use a known monster URL from environment or default
        monster_url = os.getenv('TEST_MONSTER_URL', 'monsters/17140-goblin')
        
        response = client.get(f'/api/dndbeyond/monster/{monster_url}')
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Verify monster data structure
        assert 'name' in data
        assert 'armorClass' in data or 'ac' in data
        assert 'hitPoints' in data or 'hp' in data
    
    def test_monster_caching(self, client, app, dndbeyond_cookies, skip_if_no_dndbeyond):
        """Test that monster details are cached after first fetch."""
        # Set cookies
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        cookie_file.write_text(json.dumps(dndbeyond_cookies))
        
        monster_url = os.getenv('TEST_MONSTER_URL', 'monsters/17140-goblin')
        
        # First request - fetches from API
        response1 = client.get(f'/api/dndbeyond/monster/{monster_url}')
        assert response1.status_code == 200
        
        # Verify cache file exists
        monsters_dir = CACHE_DIR / 'monsters'
        assert monsters_dir.exists()
        
        # Check if any cache file was created
        cache_files = list(monsters_dir.glob('*.json'))
        assert len(cache_files) > 0
        
        # Second request - should use cache
        response2 = client.get(f'/api/dndbeyond/monster/{monster_url}')
        assert response2.status_code == 200
        
        # Both responses should be identical
        assert response1.data == response2.data
    
    def test_fetch_monster_without_cookies(self, client):
        """Test fetching monsters without configured cookies."""
        response = client.get('/api/dndbeyond/monsters')
        # Should return error or empty list
        assert response.status_code in [200, 401, 403]


@pytest.mark.dndbeyond
class TestDndBeyondCharacters:
    """Tests for D&D Beyond character fetching (requires real API access)."""
    
    def test_fetch_character(self, client, app, dndbeyond_cookies, skip_if_no_dndbeyond):
        """Test fetching character data from D&D Beyond."""
        # Set cookies
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        cookie_file.write_text(json.dumps(dndbeyond_cookies))
        
        # Use test character URL from environment
        character_url = os.getenv('TEST_CHARACTER_URL', '12345678')
        
        response = client.get(f'/api/dndbeyond/character/{character_url}')
        
        # May return 200 with data or 404 if character doesn't exist
        if response.status_code == 200:
            data = json.loads(response.data)
            # Verify basic character data structure
            assert 'name' in data or 'data' in data
    
    def test_character_caching(self, client, app, dndbeyond_cookies, skip_if_no_dndbeyond):
        """Test that character data is cached."""
        from app import CACHE_DIR
        cookie_file = CACHE_DIR / 'cookies.json'
        cookie_file.write_text(json.dumps(dndbeyond_cookies))
        
        character_url = os.getenv('TEST_CHARACTER_URL', '12345678')
        
        # First request
        response1 = client.get(f'/api/dndbeyond/character/{character_url}')
        
        if response1.status_code == 200:
            # Verify cache directory exists
            characters_dir = CACHE_DIR / 'characters'
            
            # Second request - should use cache if first succeeded
            response2 = client.get(f'/api/dndbeyond/character/{character_url}')
            assert response2.status_code == 200


class TestImageCaching:
    """Tests for avatar image caching."""
    
    def test_cached_image_serving(self, client, app):
        """Test serving cached avatar images."""
        from app import CACHE_DIR
        
        # Create a test image file
        images_dir = CACHE_DIR / 'images'
        images_dir.mkdir(exist_ok=True)
        test_image = images_dir / 'test_avatar.jpg'
        test_image.write_bytes(b'fake image data')
        
        response = client.get('/cached/images/test_avatar.jpg')
        assert response.status_code == 200
        assert response.data == b'fake image data'
    
    def test_cached_image_not_found(self, client):
        """Test requesting non-existent cached image."""
        response = client.get('/cached/images/nonexistent.jpg')
        assert response.status_code == 404


class TestCacheManagement:
    """Tests for cache directory management."""
    
    def test_cache_directory_creation(self, app):
        """Test that cache directories are created properly."""
        from app import CACHE_DIR
        
        # Cache dir should exist from fixture
        assert CACHE_DIR.exists()
        
        # Test that subdirectories can be created
        monsters_dir = CACHE_DIR / 'monsters'
        monsters_dir.mkdir(exist_ok=True)
        assert monsters_dir.exists()
        
        characters_dir = CACHE_DIR / 'characters'
        characters_dir.mkdir(exist_ok=True)
        assert characters_dir.exists()
        
        images_dir = CACHE_DIR / 'images'
        images_dir.mkdir(exist_ok=True)
        assert images_dir.exists()
