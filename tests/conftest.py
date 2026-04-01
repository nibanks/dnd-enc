"""
Pytest configuration and shared fixtures for testing.
"""
import os
import sys
import json
import shutil
import tempfile
from pathlib import Path
import pytest

# Add parent directory to path so we can import app
sys.path.insert(0, str(Path(__file__).parent.parent))

import app as flask_app


@pytest.fixture
def app():
    """Create and configure a Flask app instance for testing."""
    # Create a temporary directory for test data
    test_dir = tempfile.mkdtemp()
    adventures_dir = Path(test_dir) / "adventures"
    cache_dir = Path(test_dir) / ".cache"
    adventures_dir.mkdir(parents=True)
    cache_dir.mkdir(parents=True)
    (cache_dir / "monsters").mkdir(parents=True)
    (cache_dir / "characters").mkdir(parents=True)
    (cache_dir / "images").mkdir(parents=True)
    
    # Store original paths
    original_data_dir = flask_app.DATA_DIR
    original_cache_dir = flask_app.CACHE_DIR
    original_cookies_cache = flask_app.COOKIES_CACHE
    original_monsters_cache = flask_app.MONSTERS_CACHE
    original_monster_details_dir = flask_app.MONSTER_DETAILS_DIR
    original_images_cache_dir = flask_app.IMAGES_CACHE_DIR
    
    # Override paths to use test directory
    flask_app.DATA_DIR = adventures_dir
    flask_app.CACHE_DIR = cache_dir
    flask_app.COOKIES_CACHE = cache_dir / "cookies.json"
    flask_app.MONSTERS_CACHE = cache_dir / "monsters.json"
    flask_app.MONSTER_DETAILS_DIR = cache_dir / "monsters"
    flask_app.IMAGES_CACHE_DIR = cache_dir / "images"
    
    # Configure app for testing
    flask_app.app.config.update({
        'TESTING': True,
        'SECRET_KEY': 'test-secret-key',
        'WTF_CSRF_ENABLED': False,
        'SERVER_NAME': 'localhost:5000'
    })
    
    yield flask_app.app
    
    # Restore original paths
    flask_app.DATA_DIR = original_data_dir
    flask_app.CACHE_DIR = original_cache_dir
    flask_app.COOKIES_CACHE = original_cookies_cache
    flask_app.MONSTERS_CACHE = original_monsters_cache
    flask_app.MONSTER_DETAILS_DIR = original_monster_details_dir
    flask_app.IMAGES_CACHE_DIR = original_images_cache_dir
    
    # Cleanup test directory after tests
    shutil.rmtree(test_dir, ignore_errors=True)


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """A test CLI runner for the app."""
    return app.test_cli_runner()


@pytest.fixture
def sample_adventure():
    """Sample adventure data for testing."""
    return {
        "name": "Test Adventure",
        "chapters": [
            {
                "name": "Chapter 1",
                "encounters": [
                    {
                        "name": "First Encounter",
                        "monsters": [
                            {"name": "Goblin", "count": 3}
                        ]
                    }
                ]
            },
            {
                "name": "Chapter 2",
                "encounters": []
            }
        ],
        "players": [
            {
                "name": "Test Player 1",
                "level": 5,
                "class": "Fighter",
                "race": "Human",
                "maxHp": 45,
                "currentHp": 45,
                "armorClass": 18
            },
            {
                "name": "Test Player 2",
                "level": 3,
                "class": "Wizard",
                "race": "Elf",
                "maxHp": 20,
                "currentHp": 20,
                "armorClass": 12
            },
            {
                "name": "Test Player 3",
                "level": 4,
                "class": "Rogue",
                "race": "Halfling",
                "maxHp": 28,
                "currentHp": 28,
                "armorClass": 15
            }
        ]
    }


@pytest.fixture
def sample_monster():
    """Sample monster data from D&D Beyond."""
    return {
        "name": "Goblin",
        "size": "Small",
        "type": "humanoid",
        "alignment": "neutral evil",
        "armorClass": 15,
        "hitPoints": 7,
        "speed": "30 ft.",
        "abilities": {
            "str": 8,
            "dex": 14,
            "con": 10,
            "int": 10,
            "wis": 8,
            "cha": 8
        },
        "challengeRating": "1/4"
    }


@pytest.fixture
def dndbeyond_cookies():
    """Load D&D Beyond cookies from environment or production cache for real API tests."""
    # First, try loading from environment variables (.env.test)
    cookies = {
        'CobaltId': os.getenv('DNDBEYOND_COOKIE_COBALTID', ''),
        'CobaltAff': os.getenv('DNDBEYOND_COOKIE_COBALTAFF', ''),
        'CobaltAT': os.getenv('DNDBEYOND_COOKIE_COBALTAT', '')
    }
    
    # If environment variables aren't set, fallback to production cookies
    if not all(cookies.values()):
        production_cookies_path = Path('.cache/cookies.json')
        if production_cookies_path.exists():
            try:
                with open(production_cookies_path, 'r', encoding='utf-8') as f:
                    production_cookies = json.load(f)
                    # Map production cookie format to test format
                    cookies = {
                        'CobaltId': production_cookies.get('CobaltId', ''),
                        'CobaltAff': production_cookies.get('CobaltAff', ''),
                        'CobaltAT': production_cookies.get('CobaltAT', '')
                    }
                    if all(cookies.values()):
                        print(f"Using production D&D Beyond cookies from .cache/cookies.json")
            except Exception as e:
                print(f"Error loading production cookies: {e}")
    
    # Check if we have cookies from either source
    if not all(cookies.values()):
        pytest.skip("D&D Beyond cookies not configured in .env.test or .cache/cookies.json")
    
    return cookies


@pytest.fixture
def skip_if_no_dndbeyond():
    """Skip test if D&D Beyond credentials are not available."""
    skip = os.getenv('SKIP_DNDBEYOND_TESTS', 'false').lower() == 'true'
    if skip:
        pytest.skip("D&D Beyond tests disabled via SKIP_DNDBEYOND_TESTS")


@pytest.fixture(autouse=True)
def reset_session(client):
    """Reset Flask session between tests."""
    with client.session_transaction() as sess:
        sess.clear()
