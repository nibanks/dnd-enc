/**
 * Tests for D&D Encounter Tracker JavaScript functionality
 */

// Mock the script.js file - in a real setup, you'd load it properly
// For now, we'll define the key functions and constants to test

// Import the constants and functions from script.js
// Note: You may need to refactor script.js to export these for testing
// or use a bundler like webpack to load the actual file

describe('D&D Encounter Tracker - Constants and Data', () => {
  // Define constants for testing (these should match script.js)
  const CR_TO_XP = {
    '0': 10,
    '1/8': 25,
    '1/4': 50,
    '1/2': 100,
    '1': 200,
    '2': 450,
    '3': 700,
    '4': 1100,
    '5': 1800,
    '6': 2300,
    '7': 2900,
    '8': 3900,
    '9': 5000,
    '10': 5900,
    '11': 7200,
    '12': 8400,
    '13': 10000,
    '14': 11500,
    '15': 13000,
    '16': 15000,
    '17': 18000,
    '18': 20000,
    '19': 22000,
    '20': 25000,
    '21': 33000,
    '22': 41000,
    '23': 50000,
    '24': 62000,
    '25': 75000,
    '26': 90000,
    '27': 105000,
    '28': 120000,
    '29': 135000,
    '30': 155000
  };

  test('CR_TO_XP mapping contains all standard CRs', () => {
    expect(CR_TO_XP['0']).toBe(10);
    expect(CR_TO_XP['1/8']).toBe(25);
    expect(CR_TO_XP['1/4']).toBe(50);
    expect(CR_TO_XP['1/2']).toBe(100);
    expect(CR_TO_XP['1']).toBe(200);
    expect(CR_TO_XP['10']).toBe(5900);
    expect(CR_TO_XP['20']).toBe(25000);
    expect(CR_TO_XP['30']).toBe(155000);
  });

  test('CR fractional values are correctly mapped', () => {
    expect(CR_TO_XP['1/8']).toBeLessThan(CR_TO_XP['1/4']);
    expect(CR_TO_XP['1/4']).toBeLessThan(CR_TO_XP['1/2']);
    expect(CR_TO_XP['1/2']).toBeLessThan(CR_TO_XP['1']);
  });

  test('CR XP values increase with CR rating', () => {
    // Test specific CR progressions
    expect(CR_TO_XP['0']).toBeLessThan(CR_TO_XP['1/8']);
    expect(CR_TO_XP['1/8']).toBeLessThan(CR_TO_XP['1/4']);
    expect(CR_TO_XP['1/4']).toBeLessThan(CR_TO_XP['1/2']);
    expect(CR_TO_XP['1/2']).toBeLessThan(CR_TO_XP['1']);
    expect(CR_TO_XP['1']).toBeLessThan(CR_TO_XP['5']);
    expect(CR_TO_XP['5']).toBeLessThan(CR_TO_XP['10']);
    expect(CR_TO_XP['10']).toBeLessThan(CR_TO_XP['20']);
    expect(CR_TO_XP['20']).toBeLessThan(CR_TO_XP['30']);
  });
});

describe('Global State Management', () => {
  let mockState;

  beforeEach(() => {
    // Initialize mock state
    mockState = {
      currentAdventure: null,
      currentChapter: null,
      DND_MONSTERS: {},
      MONSTER_DETAILS_CACHE: {},
      monstersLoaded: false,
      hasCookies: false,
      playersExpanded: true,
      playersEditMode: false,
      encounterEditMode: {},
      crFetchStatus: {},
      monsterDetailsFetchStatus: {}
    };
  });

  test('initial state is correct', () => {
    expect(mockState.currentAdventure).toBeNull();
    expect(mockState.currentChapter).toBeNull();
    expect(mockState.DND_MONSTERS).toEqual({});
    expect(mockState.MONSTER_DETAILS_CACHE).toEqual({});
    expect(mockState.monstersLoaded).toBe(false);
    expect(mockState.hasCookies).toBe(false);
    expect(mockState.playersExpanded).toBe(true);
    expect(mockState.playersEditMode).toBe(false);
  });

  test('state can be updated', () => {
    mockState.currentAdventure = { name: 'Test Adventure' };
    mockState.monstersLoaded = true;
    mockState.hasCookies = true;

    expect(mockState.currentAdventure.name).toBe('Test Adventure');
    expect(mockState.monstersLoaded).toBe(true);
    expect(mockState.hasCookies).toBe(true);
  });

  test('cache objects can store data', () => {
    mockState.MONSTER_DETAILS_CACHE['goblin'] = {
      name: 'Goblin',
      cr: '1/4',
      hp: 7
    };

    expect(mockState.MONSTER_DETAILS_CACHE['goblin'].name).toBe('Goblin');
    expect(mockState.MONSTER_DETAILS_CACHE['goblin'].cr).toBe('1/4');
  });

  test('fetch status tracking prevents duplicates', () => {
    const encounterKey = '0_1';
    expect(mockState.crFetchStatus[encounterKey]).toBeUndefined();

    mockState.crFetchStatus[encounterKey] = true;
    expect(mockState.crFetchStatus[encounterKey]).toBe(true);
  });
});

describe('Adventure Data Validation', () => {
  test('valid adventure structure', () => {
    const adventure = {
      name: 'Test Adventure',
      chapters: [
        {
          name: 'Chapter 1',
          encounters: []
        }
      ],
      players: []
    };

    expect(adventure.name).toBeDefined();
    expect(Array.isArray(adventure.chapters)).toBe(true);
    expect(Array.isArray(adventure.players)).toBe(true);
  });

  test('player data has required fields', () => {
    const player = {
      name: 'Test Player',
      level: 5,
      class: 'Fighter',
      race: 'Human',
      maxHp: 45,
      currentHp: 45,
      armorClass: 18
    };

    expect(player.name).toBeDefined();
    expect(player.level).toBeGreaterThan(0);
    expect(player.maxHp).toBeGreaterThanOrEqual(player.currentHp);
  });

  test('encounter data structure', () => {
    const encounter = {
      name: 'Test Encounter',
      monsters: [
        { name: 'Goblin',  count: 3, url: 'monsters/17140-goblin' }
      ],
      description: 'A test encounter'
    };

    expect(encounter.name).toBeDefined();
    expect(Array.isArray(encounter.monsters)).toBe(true);
    expect(encounter.monsters[0].count).toBeGreaterThan(0);
  });
});

describe('XP Calculation', () => {
  const CR_TO_XP = {
    '0': 10,
    '1/8': 25,
    '1/4': 50,
    '1/2': 100,
    '1': 200,
    '2': 450,
    '3': 700,
    '4': 1100,
    '5': 1800
  };

  function calculateEncounterXP(monsters) {
    return monsters.reduce((total, monster) => {
      const xp = CR_TO_XP[monster.cr] || 0;
      return total + (xp * monster.count);
    }, 0);
  }

  test('calculate XP for single monster', () => {
    const monsters = [{ cr: '1/4', count: 1 }];
    const xp = calculateEncounterXP(monsters);
    expect(xp).toBe(50);
  });

  test('calculate XP for multiple monsters of same type', () => {
    const monsters = [{ cr: '1/4', count: 3 }];
    const xp = calculateEncounterXP(monsters);
    expect(xp).toBe(150); // 50 * 3
  });

  test('calculate XP for mixed monster types', () => {
    const monsters = [
      { cr: '1/4', count: 2 },
      { cr: '1', count: 1 }
    ];
    const xp = calculateEncounterXP(monsters);
    expect(xp).toBe(300); // (50 * 2) + (200 * 1)
  });

  test('handle invalid CR gracefully', () => {
    const monsters = [{ cr: 'invalid', count: 1 }];
    const xp = calculateEncounterXP(monsters);
    expect(xp).toBe(0);
  });

  test('handle zero count', () => {
    const monsters = [{ cr: '1', count: 0 }];
    const xp = calculateEncounterXP(monsters);
    expect(xp).toBe(0);
  });
});

describe('HP Calculations', () => {
  test('damage reduces current HP', () => {
    let player = { maxHp: 45, currentHp: 45 };
    const damage = 10;
    
    player.currentHp -= damage;
    
    expect(player.currentHp).toBe(35);
    expect(player.currentHp).toBeLessThan(player.maxHp);
  });

  test('healing increases current HP', () => {
    let player = { maxHp: 45, currentHp: 20 };
    const healing = 15;
    
    player.currentHp += healing;
    
    expect(player.currentHp).toBe(35);
  });

  test('healing cannot exceed max HP', () => {
    let player = { maxHp: 45, currentHp: 40 };
    const healing = 10;
    
    player.currentHp = Math.min(player.currentHp + healing, player.maxHp);
    
    expect(player.currentHp).toBe(45);
    expect(player.currentHp).toBeLessThanOrEqual(player.maxHp);
  });

  test('damage cannot reduce HP below 0', () => {
    let player = { maxHp: 45, currentHp: 5 };
    const damage = 10;
    
    player.currentHp = Math.max(player.currentHp - damage, 0);
    
    expect(player.currentHp).toBe(0);
    expect(player.currentHp).toBeGreaterThanOrEqual(0);
  });

  test('temp HP is tracked separately', () => {
    let player = { maxHp: 45, currentHp: 45, tempHp: 0 };
    
    player.tempHp = 10;
    
    expect(player.tempHp).toBe(10);
    expect(player.currentHp).toBe(45); // Temp HP doesn't affect current HP
  });
});

describe('Data Structures', () => {
  const DND_CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
    'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
    'Warlock', 'Wizard'
  ];

  const DND_RACES = [
    'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf',
    'Half-Orc', 'Halfling', 'Human', 'Tiefling'
  ];

  test('D&D classes list is complete', () => {
    expect(DND_CLASSES).toContain('Fighter');
    expect(DND_CLASSES).toContain('Wizard');
    expect(DND_CLASSES).toContain('Rogue');
    expect(DND_CLASSES.length).toBe(12);
  });

  test('D&D races list contains standard races', () => {
    expect(DND_RACES).toContain('Human');
    expect(DND_RACES).toContain('Elf');
    expect(DND_RACES).toContain('Dwarf');
    expect(DND_RACES.length).toBeGreaterThanOrEqual(9);
  });

  test('classes are unique', () => {
    const uniqueClasses = [...new Set(DND_CLASSES)];
    expect(uniqueClasses.length).toBe(DND_CLASSES.length);
  });

  test('races are unique', () => {
    const uniqueRaces = [...new Set(DND_RACES)];
    expect(uniqueRaces.length).toBe(DND_RACES.length);
  });
});

describe('Ability Score Modifiers', () => {
  function getAbilityModifier(score) {
    return Math.floor((score - 10) / 2);
  }

  test('calculate ability modifiers correctly', () => {
    expect(getAbilityModifier(10)).toBe(0);
    expect(getAbilityModifier(11)).toBe(0);
    expect(getAbilityModifier(12)).toBe(1);
    expect(getAbilityModifier(14)).toBe(2);
    expect(getAbilityModifier(16)).toBe(3);
    expect(getAbilityModifier(18)).toBe(4);
    expect(getAbilityModifier(20)).toBe(5);
  });

  test('negative modifiers for low scores', () => {
    expect(getAbilityModifier(8)).toBe(-1);
    expect(getAbilityModifier(6)).toBe(-2);
    expect(getAbilityModifier(4)).toBe(-3);
  });

  test('edge cases', () => {
    expect(getAbilityModifier(1)).toBe(-5);  // Min score: (1-10)/2 = -4.5 -> -5
    expect(getAbilityModifier(30)).toBe(10); // Max normal score
  });
});

describe('DOM Manipulation', () => {
  beforeEach(() => {
    // Set up DOM elements for testing
    document.body.innerHTML = `
      <div id="attackResultModal" class="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <div id="attackResultContent"></div>
        </div>
      </div>
      <div id="settingsModal" class="modal"></div>
      <div id="playersSection">
        <div id="playersTableContainer"></div>
      </div>
      <button id="togglePlayersBtn">Toggle Players</button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('modal can be opened and closed', () => {
    const modal = document.getElementById('attackResultModal');
    
    // Open modal
    modal.style.display = 'block';
    expect(modal.style.display).toBe('block');
    
    // Close modal
    modal.style.display = 'none';
    expect(modal.style.display).toBe('none');
  });

  test('modal content can be updated', () => {
    const content = document.getElementById('attackResultContent');
    const testHTML = '<p>Test content</p>';
    
    content.innerHTML = testHTML;
    
    expect(content.innerHTML).toBe(testHTML);
    expect(content.querySelector('p')).not.toBeNull();
    expect(content.querySelector('p').textContent).toBe('Test content');
  });

  test('toggle players section', () => {
    const playersSection = document.getElementById('playersSection');
    let isExpanded = true;
    
    // Toggle to collapsed
    if (isExpanded) {
      playersSection.style.display = 'none';
      isExpanded = false;
    }
    
    expect(playersSection.style.display).toBe('none');
    expect(isExpanded).toBe(false);
    
    // Toggle back to expanded
    if (!isExpanded) {
      playersSection.style.display = 'block';
      isExpanded = true;
    }
    
    expect(playersSection.style.display).toBe('block');
    expect(isExpanded).toBe(true);
  });

  test('creating table rows dynamically', () => {
    const container = document.getElementById('playersTableContainer');
    const players = [
      { name: 'Player 1', level: 5, class: 'Fighter' },
      { name: 'Player 2', level: 3, class: 'Wizard' }
    ];
    
    const table = document.createElement('table');
    players.forEach(player => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${player.name}</td>
        <td>${player.level}</td>
        <td>${player.class}</td>
      `;
      table.appendChild(row);
    });
    
    container.appendChild(table);
    
    expect(table.querySelectorAll('tr').length).toBe(2);
    expect(table.querySelector('tr td').textContent).toBe('Player 1');
  });

  test('updating DOM elements with new data', () => {
    document.body.innerHTML = '<div id="playerHp">45</div>';
    const hpElement = document.getElementById('playerHp');
    
    let currentHp = 45;
    currentHp -= 10; // Take damage
    hpElement.textContent = currentHp;
    
    expect(hpElement.textContent).toBe('35');
    expect(parseInt(hpElement.textContent)).toBe(35);
  });

  test('adding CSS classes dynamically', () => {
    document.body.innerHTML = '<div id="player"></div>';
    const playerElement = document.getElementById('player');
    
    // Add class for low HP
    playerElement.classList.add('low-hp');
    expect(playerElement.classList.contains('low-hp')).toBe(true);
    
    // Remove class when healed
    playerElement.classList.remove('low-hp');
    expect(playerElement.classList.contains('low-hp')).toBe(false);
  });

  test('event listeners can be attached', () => {
    const button = document.getElementById('togglePlayersBtn');
    let clicked = false;
    
    button.addEventListener('click', () => {
      clicked = true;
    });
    
    button.click();
    expect(clicked).toBe(true);
  });
});

describe('API Integration', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('fetch adventures list', async () => {
    const mockAdventures = ['Adventure 1', 'Adventure 2'];
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdventures
    });
    
    const response = await fetch('/api/adventures');
    const data = await response.json();
    
    expect(fetch).toHaveBeenCalledWith('/api/adventures');
    expect(data).toEqual(mockAdventures);
  });

  test('load specific adventure', async () => {
    const mockAdventure = {
      name: 'Test Adventure',
      chapters: [],
      players: []
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdventure
    });
    
    const response = await fetch('/api/adventure/Test Adventure');
    const data = await response.json();
    
    expect(fetch).toHaveBeenCalledWith('/api/adventure/Test Adventure');
    expect(data.name).toBe('Test Adventure');
  });

  test('save adventure', async () => {
    const adventure = {
      name: 'Test Adventure',
      chapters: [],
      players: []
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    const response = await fetch('/api/adventure/Test Adventure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adventure)
    });
    
    const data = await response.json();
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/adventure/Test Adventure',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
    expect(data.success).toBe(true);
  });

  test('fetch D&D Beyond monsters', async () => {
    const mockMonsters = [
      { id: 1, name: 'Goblin', url: 'monsters/17140-goblin' },
      { id: 2, name: 'Kobold', url: 'monsters/17145-kobold' }
    ];
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMonsters
    });
    
    const response = await fetch('/api/dndbeyond/monsters');
    const data = await response.json();
    
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Goblin');
  });

  test('fetch monster details with caching', async () => {
    const cache = {};
    const monsterUrl = 'monsters/17140-goblin';
    const mockMonster = { name: 'Goblin', cr: '1/4', hp: 7 };
    
    // First fetch - from API
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMonster
    });
    
    if (!cache[monsterUrl]) {
      const response = await fetch(`/api/dndbeyond/monster/${monsterUrl}`);
      cache[monsterUrl] = await response.json();
    }
    
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cache[monsterUrl].name).toBe('Goblin');
    
    // Second fetch - from cache
    const cachedMonster = cache[monsterUrl];
    
    expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    expect(cachedMonster.name).toBe('Goblin');
  });

  test('handle API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    
    try {
      await fetch('/api/adventures');
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toBe('Network error');
    }
  });

  test('handle 404 responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' })
    });
    
    const response = await fetch('/api/adventure/NonExistent');
    const data = await response.json();
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  test('verify PIN for protected adventure', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    const response = await fetch('/api/adventure/Protected Adventure/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    
    const data = await response.json();
    
    expect(data.success).toBe(true);
  });

  test('check cookie status', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true })
    });
    
    const response = await fetch('/api/dndbeyond/cookie-status');
    const data = await response.json();
    
    expect(data.configured).toBe(true);
  });
});

describe('SessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('save and retrieve scroll position', () => {
    const scrollPosition = 500;
    
    sessionStorage.setItem('scrollPosition', scrollPosition);
    const retrieved = sessionStorage.getItem('scrollPosition');
    
    expect(retrieved).toBe('500');
    expect(parseInt(retrieved)).toBe(scrollPosition);
  });

  test('sessionStorage persists data', () => {
    sessionStorage.setItem('testKey', 'testValue');
    
    expect(sessionStorage.getItem('testKey')).toBe('testValue');
  });

  test('sessionStorage can be cleared', () => {
    sessionStorage.setItem('key1', 'value1');
    sessionStorage.setItem('key2', 'value2');
    
    sessionStorage.clear();
    
    expect(sessionStorage.getItem('key1')).toBeNull();
    expect(sessionStorage.getItem('key2')).toBeNull();
  });

  test('remove specific item from sessionStorage', () => {
    sessionStorage.setItem('keep', 'value1');
    sessionStorage.setItem('remove', 'value2');
    
    sessionStorage.removeItem('remove');
    
    expect(sessionStorage.getItem('keep')).toBe('value1');
    expect(sessionStorage.getItem('remove')).toBeNull();
  });
});

describe('Error Handling', () => {
  test('handle missing DOM elements gracefully', () => {
    const element = document.getElementById('nonexistent');
    expect(element).toBeNull();
    
    // Should not throw when checking null
    if (element) {
      element.textContent = 'test';
    }
    // Test passes if no error thrown
  });

  test('handle invalid JSON gracefully', () => {
    const invalidJSON = '{invalid json}';
    
    expect(() => {
      JSON.parse(invalidJSON);
    }).toThrow();
  });

  test('handle undefined adventure data', () => {
    let adventure = undefined;
    
    const safeGetName = () => {
      return adventure?.name || 'Unnamed Adventure';
    };
    
    expect(safeGetName()).toBe('Unnamed Adventure');
  });

  test('handle division by zero', () => {
    const result = 10 / 0;
    expect(result).toBe(Infinity);
  });

  test('handle empty arrays', () => {
    const players = [];
    const averageLevel = players.length > 0
      ? players.reduce((sum, p) => sum + p.level, 0) / players.length
      : 0;
    
    expect(averageLevel).toBe(0);
  });
});
