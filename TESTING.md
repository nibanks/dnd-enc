# Testing Guide for D&D Encounter Tracker

This guide explains how to set up and run tests for the D&D Encounter Tracker application. Tests are designed to be run by both humans and AI models to ensure code changes don't break functionality.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)
- [For AI Models](#for-ai-models)

## Overview

The D&D Encounter Tracker has two test suites:

1. **Backend Tests (Python/pytest)**: Tests for Flask API endpoints, adventure management, PIN protection, session management, and caching
2. **Frontend Tests (JavaScript/Jest)**: Tests for UI logic, state management, calculations, and DOM manipulation

**Current Status:**
- ✅ Backend: 34/34 core tests passing
- ✅ Frontend: 52/52 tests passing
- ⏭️ 6 D&D Beyond API integration tests (optional - require cookies)

## Setup

### Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed (for JavaScript tests)
- A virtual environment activated (recommended)

### Backend Test Setup

1. **Install Python test dependencies:**

```powershell
# Activate virtual environment first
.\.venv\Scripts\Activate.ps1

# Install test dependencies
pip install -r requirements.txt
```

2. **Configure D&D Beyond test credentials (OPTIONAL):**

**D&D Beyond API integration tests are optional.** The core test suite (34 backend tests + 52 frontend tests) runs without them.

If you want to test D&D Beyond API integration, the tests will automatically use your production cookies from `.cache/cookies.json` if they exist.

**To enable D&D Beyond integration tests:**
- **Option 1 (Easiest):** Set up cookies in the production app via Settings
- **Option 2:** Run `.\setup_cookies.ps1` to configure them manually
- **Option 3:** Create `.env.test` with test-specific credentials (see `.env.test.example`)

**Cookie Priority:**
1. Tests first check `.env.test` for cookies
2. If not found, tests use production cookies from `.cache/cookies.json`
3. If neither exists, D&D Beyond integration tests are skipped (6 tests)

**How to get D&D Beyond cookies:**
1. Log in to [dndbeyond.com](https://www.dndbeyond.com)
2. Open Browser Developer Tools (F12)
3. Go to Application > Cookies > https://www.dndbeyond.com
4. Copy the values for `CobaltId`, `CobaltAff`, and `CobaltAT`

**Note:** Tests marked with `@pytest.mark.dndbeyond` require valid cookies. 

**To enable D&D Beyond integration tests:**
1. **Easiest:** Set up cookies in the production app (via Settings), which saves to `.cache/cookies.json`
2. **Or:** Create `.env.test` with separate test credentials (see above)

Other tests will run without them.

### Frontend Test Setup

1. **Install Node.js dependencies:**

**Note:** If you just installed Node.js, you may need to:
- Close and reopen your terminal/PowerShell window
- Or restart VS Code for the PATH to update

Then install dependencies:

```powershell
npm install
```

This will install Jest, jsdom, and testing utilities.

**Verify Node.js is available:**
```powershell
node --version
npm --version
```

If these commands don't work, Node.js may not be in your PATH. You can:
- Restart your terminal/PowerShell
- Restart VS Code
- Or manually add Node.js to your PATH

## Running Tests

### Quick Test (All Tests)

Run all backend and frontend tests:

```powershell
# Backend tests
pytest

# Frontend tests
npm test
```

### Backend Tests Only

```powershell
# Run all backend tests
pytest

# Run specific test file
pytest tests/test_adventures.py

# Run specific test class
pytest tests/test_adventures.py::TestAdventureList

# Run specific test
pytest tests/test_adventures.py::TestAdventureList::test_list_adventures_empty

# Run with verbose output
pytest -v

# Run tests matching a pattern
pytest -k "adventure"

# Skip D&D Beyond tests (if no cookies configured)
pytest -m "not dndbeyond"
```

### Frontend Tests Only

```powershell
# Run all frontend tests
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/test_script.js

# Run tests matching a pattern
npm test -- -t "XP Calculation"
```

### Test Coverage

Generate coverage reports to see which code is tested:

```powershell
# Backend coverage
pytest --cov=app --cov-report=html

# Frontend coverage
npm run test:coverage
```

Coverage reports will be generated in:
- Backend: `htmlcov/index.html`
- Frontend: `coverage/index.html`

Open these files in a browser to view detailed coverage information.

## Test Organization

### Backend Tests

Located in `tests/` directory:

- `conftest.py` - Shared fixtures and test configuration
- `test_adventures.py` - Adventure CRUD operations
- `test_dndbeyond.py` - D&D Beyond API integration and caching
- `test_sessions.py` - PIN protection and session management

### Frontend Tests

Located in `tests/` directory:

- `test_script.js` - JavaScript logic, state management, calculations, DOM manipulation, and API integration
- `setup.js` - Jest configuration and global mocks

### Test Fixtures

Sample data for testing:

- `tests/fixtures/sample_adventure.json` - Complete adventure with chapters and players
- `tests/fixtures/sample_monster.json` - Monster data structure
- `tests/fixtures/sample_character.json` - Character data structure
- `tests/fixtures/protected_adventure.json` - PIN-protected adventure

## Test Categories

### Backend Test Categories

1. **Adventure Management**
   - List adventures
   - Create new adventures
   - Load adventures
   - Update adventures
   - Delete adventures
   - Data integrity

2. **D&D Beyond Integration**
   - Cookie management
   - Fetch monsters list
   - Fetch monster details
   - Fetch character data
   - Caching behavior
   - Image caching

3. **PIN Protection & Sessions**
   - Check PIN requirements
   - Verify correct/incorrect PINs
   - Session persistence
   - Session invalidation
   - Security features

### Frontend Test Categories

1. **Constants & Data**
   - CR to XP mappings
   - D&D classes and races
   - Data structure validation

2. **State Management**
   - Global state initialization
   - State updates
   - Cache management
   - Fetch status tracking

3. **Calculations**
   - XP calculations
   - HP calculations (damage/healing)
   - Ability score modifiers

4. **DOM Manipulation**
   - Modal open/close
   - Dynamic table generation
   - CSS class management
   - Event listeners

5. **API Integration**
   - Fetch adventures
   - Save adventures
   - Fetch monsters
   - Caching logic
   - Error handling

## Writing New Tests

### Backend Test Example

```python
def test_new_feature(client, app):
    """Test description."""
    # Arrange
    test_data = {"key": "value"}
    
    # Act
    response = client.post('/api/endpoint', 
                          data=json.dumps(test_data),
                          content_type='application/json')
    
    # Assert
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
```

### Frontend Test Example

```javascript
test('new feature works correctly', () => {
  // Arrange
  const input = 'test';
  
  // Act
  const result = someFunction(input);
  
  // Assert
  expect(result).toBe('expected');
});
```

## Troubleshooting

### Common Issues

**Backend: "ModuleNotFoundError: No module named 'app'"**
- Solution: Ensure you're running tests from the project root directory
- Solution: Check that `tests/conftest.py` exists and sets up the Python path

**Backend: "D&D Beyond tests failing"**
- Solution: Cookies may have expired. Update `.env.test` with fresh cookies
- Solution: Skip D&D Beyond tests with: `pytest -m "not dndbeyond"`

**Frontend: "Cannot find module 'jest'"**
- Solution: Run `npm install` to install dependencies

**Frontend: "ReferenceError: fetch is not defined"**
- Solution: Check that `tests/setup.js` is properly configured in `jest.config.js`

**Tests pass individually but fail when run together**
- Solution: Tests may have shared state. Ensure fixtures properly reset between tests
- Solution: Check `conftest.py` `autouse` fixtures are cleaning up properly

### Debugging Tests

```powershell
# Backend: Run with Python debugger
pytest --pdb

# Backend: Print output (shows print statements)
pytest -s

# Backend: Stop on first failure
pytest -x

# Frontend: Run single test file
npm test -- tests/test_script.js

# Frontend: Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## For AI Models

### Quick Test Command

To verify code changes haven't broken anything:

```powershell
# Run all tests
pytest && npm test
```

### Interpreting Test Results

**Success Output:**
```
===== X passed in Y.YYs =====  (Backend)
PASS tests/test_script.js     (Frontend)
```

**Failure Output:**
```
FAILED tests/test_adventures.py::test_name - AssertionError: ...
FAIL tests/test_script.js
```

### When to Run Tests

AI models should run tests:
1. **After making code changes** - Verify functionality isn't broken
2. **Before completing a task** - Ensure all changes work correctly
3. **When adding new features** - Confirm integration with existing code
4. **When fixing bugs** - Verify the fix works and doesn't create regressions

### Test-Driven Development

For new features:
1. Write a failing test first
2. Implement the feature
3. Run tests to verify it works
4. Refactor if needed while keeping tests passing

### Skipping Specific Tests

If you need to skip tests temporarily:

```powershell
# Backend: Skip by marker
pytest -m "not dndbeyond"

# Backend: Skip by keyword
pytest -k "not slow"

# Frontend: Skip specific test file
npm test -- --testPathIgnorePatterns=test_script.js
```

### Coverage Goals

Aim for:
- **Backend**: 80%+ coverage of `app.py`
- **Frontend**: 70%+ coverage of `static/script.js`

Check coverage:
```powershell
pytest --cov=app --cov-report=term-missing
npm run test:coverage
```

### Expected Test Runtime

- Backend tests: 5-30 seconds (depending on D&D Beyond tests)
- Frontend tests: 3-10 seconds
- Total: < 1 minute

If tests take significantly longer, investigate slow tests or network issues.

### Test Markers

Backend tests use pytest markers:
- `@pytest.mark.dndbeyond` - Requires D&D Beyond API access
- Tests without markers - Can run without external dependencies

### Critical Tests

These test files contain critical functionality tests that should never fail:
- `test_adventures.py` - Core adventure management
- `test_script.js` - Core frontend logic

If these fail, the application is likely broken.

## Continuous Integration

To set up automated testing in CI/CD:

1. Install dependencies in CI environment
2. Configure `.env.test` (use CI secrets for cookies)
3. Run: `pytest && npm test`
4. Fail build if tests fail
5. Generate and store coverage reports

Example GitHub Actions workflow would run these commands on every push/PR.

## Additional Resources

- [pytest documentation](https://docs.pytest.org/)
- [Jest documentation](https://jestjs.io/)
- [Flask testing guide](https://flask.palletsprojects.com/en/latest/testing/)

## Questions or Issues

If you encounter issues with tests:
1. Check this guide's Troubleshooting section
2. Verify all dependencies are installed
3. Ensure you're in the correct directory
4. Check that virtual environment is activated (Python)
5. Try deleting `node_modules` and running `npm install` again (JavaScript)
