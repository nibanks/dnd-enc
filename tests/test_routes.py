"""
Tests for main page routes and utility endpoints.
"""
import json
import pytest


class TestMainPageRoutes:
    """Tests for main HTML page routes."""
    
    def test_index_page(self, client):
        """Test main index page loads."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'text/html' in response.content_type.encode()
    
    def test_statistics_page(self, client):
        """Test statistics page loads."""
        response = client.get('/statistics')
        assert response.status_code == 200
        assert b'text/html' in response.content_type.encode()
    
    def test_spectator_page(self, client):
        """Test spectator view page loads."""
        response = client.get('/spectator')
        assert response.status_code == 200
        assert b'text/html' in response.content_type.encode()


class TestUtilityEndpoints:
    """Tests for utility API endpoints."""
    
    def test_server_info(self, client):
        """Test server info endpoint returns server information."""
        response = client.get('/api/server-info')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Check for expected fields (ip, port, etc.)
        assert isinstance(data, dict)
        # The endpoint returns server network info
        assert len(data) > 0
    
    def test_current_encounter_empty(self, client, app):
        """Test current encounter endpoint with no active encounter."""
        # Clear any existing sessions
        with client.session_transaction() as sess:
            sess.clear()
        
        response = client.get('/api/current-encounter')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Should return some structure (depends on implementation)
        # At minimum should not error
        assert isinstance(data, dict)
    
    def test_current_encounter_with_active(self, client, app, sample_adventure):
        """Test current encounter endpoint with active encounter."""
        from app import DATA_DIR
        
        # Create an adventure with an encounter
        sample_adventure['name'] = 'Active Adventure'
        sample_adventure['encounters'] = [{
            'name': 'Test Encounter',
            'chapter': 'Chapter 1',
            'combatants': [
                {
                    'name': 'Goblin',
                    'hp': 7,
                    'maxHp': 7,
                    'ac': 15,
                    'initiative': 12
                }
            ],
            'active': True,
            'round': 1,
            'turnIndex': 0
        }]
        
        adventure_path = DATA_DIR / "Active Adventure.json"
        adventure_path.write_text(json.dumps(sample_adventure))
        
        # Set the active encounter in session
        with client.session_transaction() as sess:
            sess['current_adventure'] = 'Active Adventure'
            sess['current_encounter'] = 0
        
        response = client.get('/api/current-encounter')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert isinstance(data, dict)


class TestImageCaching:
    """Additional tests for image caching functionality."""
    
    def test_serve_cached_image_not_found(self, client):
        """Test serving non-existent cached image returns 404."""
        response = client.get('/cached/images/nonexistent.jpg')
        assert response.status_code == 404
    
    def test_serve_cached_image_invalid_path(self, client):
        """Test serving image with path traversal attempt."""
        response = client.get('/cached/images/../../../etc/passwd')
        # Flask should handle this safely
        assert response.status_code in [400, 404]


class TestAdventureDataIntegrity:
    """Additional tests for adventure data handling."""
    
    def test_create_adventure_with_minimal_data(self, client):
        """Test creating adventure with only required fields."""
        minimal_adventure = {
            "name": "Minimal Adventure"
        }
        
        response = client.post(
            '/api/adventure',
            data=json.dumps(minimal_adventure),
            content_type='application/json'
        )
        
        # Should accept and fill in defaults
        assert response.status_code in [200, 201]
    
    def test_create_adventure_with_special_chars_in_name(self, client):
        """Test creating adventure with special characters in name."""
        special_adventure = {
            "name": "Test & Adventure: The <Quest> [Part 1]",
            "chapters": []
        }
        
        response = client.post(
            '/api/adventure',
            data=json.dumps(special_adventure),
            content_type='application/json'
        )
        
        # Should handle special characters
        assert response.status_code in [200, 201]
    
    def test_load_adventure_with_missing_file(self, client):
        """Test loading non-existent adventure."""
        response = client.get('/api/adventure/NonExistent%20Adventure')
        assert response.status_code == 404
    
    def test_update_adventure_with_partial_data(self, client, app, sample_adventure):
        """Test updating adventure with partial data."""
        from app import DATA_DIR
        
        # Create adventure first
        adventure_path = DATA_DIR / "Update Test.json"
        adventure_path.write_text(json.dumps(sample_adventure))
        
        # Update with partial data
        updates = {
            "name": "Update Test",
            "chapters": ["New Chapter"]
        }
        
        response = client.post(
            '/api/adventure/Update%20Test',
            data=json.dumps(updates),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        
        # Verify update
        with open(adventure_path, 'r', encoding='utf-8') as f:
            updated = json.load(f)
        
        assert updated['chapters'] == ["New Chapter"]
    
    def test_delete_adventure_twice(self, client, app, sample_adventure):
        """Test deleting the same adventure twice."""
        from app import DATA_DIR
        
        # Create adventure
        adventure_path = DATA_DIR / "Delete Test.json"
        adventure_path.write_text(json.dumps(sample_adventure))
        
        # First delete
        response1 = client.delete('/api/adventure/Delete%20Test')
        assert response1.status_code == 200
        
        # Second delete should return 404
        response2 = client.delete('/api/adventure/Delete%20Test')
        assert response2.status_code == 404


class TestErrorHandling:
    """Tests for error handling across different endpoints."""
    
    def test_invalid_json_in_request(self, client):
        """Test sending invalid JSON to API."""
        response = client.post(
            '/api/adventure',
            data='{"invalid": json}',
            content_type='application/json'
        )
        
        # Should return error
        assert response.status_code in [400, 500]
    
    def test_empty_request_body(self, client):
        """Test sending empty body to API that expects data."""
        response = client.post(
            '/api/adventure',
            data='',
            content_type='application/json'
        )
        
        # Should return error
        assert response.status_code in [400, 500]
    
    def test_missing_content_type(self, client):
        """Test POST without content-type header."""
        response = client.post(
            '/api/adventure',
            data=json.dumps({"name": "Test"})
        )
        
        # Should still work or return clear error
        assert response.status_code in [200, 201, 400, 415]
