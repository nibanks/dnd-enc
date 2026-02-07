// Global state
let currentAdventure = null;
let currentChapter = null;
let autoSaveTimeout = null;
let DND_MONSTERS = {}; // Will be populated dynamically or use fallback
let monstersLoaded = false;
let hasCookies = false; // Track cookie authentication status
let playersExpanded = true; // Track players section state
let playersEditMode = false; // Track players edit mode
let initiativeChart = null; // Chart instance for initiative distribution
let crChart = null; // Chart instance for CR over time
let damageChart = null; // Chart instance for damage dealt per encounter

// D&D 5e/2024 Classes
const DND_CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
    'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
];

// D&D 5e/2024 Races
const DND_RACES = [
    'Aarakocra', 'Aasimar', 'Bugbear', 'Dragonborn', 'Dwarf', 'Elf', 'Firbolg', 
    'Genasi', 'Gnome', 'Goblin', 'Goliath', 'Half-Elf', 'Half-Orc', 'Halfling', 
    'Hobgoblin', 'Human', 'Kenku', 'Kobold', 'Leonin', 'Lizardfolk', 'Orc', 
    'Satyr', 'Tabaxi', 'Tiefling', 'Tortle', 'Triton', 'Warforged', 'Yuan-ti'
];

// CR to XP mapping (D&D 5e)
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

// Expanded monster database (D&D 2024)
const FALLBACK_MONSTERS = {
    // CR 0
    'Baboon': { cr: '0', ac: 12, hp: 3, url: 'https://www.dndbeyond.com/monsters/4775818-baboon' },
    'Badger': { cr: '0', ac: 10, hp: 3, url: 'https://www.dndbeyond.com/monsters/4775819-badger' },
    'Cat': { cr: '0', ac: 12, hp: 2, url: 'https://www.dndbeyond.com/monsters/4775828-cat' },
    'Commoner': { cr: '0', ac: 10, hp: 4, url: 'https://www.dndbeyond.com/monsters/4775835-commoner' },
    'Crab': { cr: '0', ac: 11, hp: 2, url: 'https://www.dndbeyond.com/monsters/4775837-crab' },
    'Deer': { cr: '0', ac: 13, hp: 4, url: 'https://www.dndbeyond.com/monsters/4775840-deer' },
    'Eagle': { cr: '0', ac: 12, hp: 3, url: 'https://www.dndbeyond.com/monsters/4775844-eagle' },
    'Frog': { cr: '0', ac: 11, hp: 1, url: 'https://www.dndbeyond.com/monsters/4775850-frog' },
    'Goat': { cr: '0', ac: 10, hp: 4, url: 'https://www.dndbeyond.com/monsters/4775855-goat' },
    'Hyena': { cr: '0', ac: 11, hp: 5, url: 'https://www.dndbeyond.com/monsters/4775868-hyena' },
    'Jackal': { cr: '0', ac: 12, hp: 3, url: 'https://www.dndbeyond.com/monsters/4775869-jackal' },
    'Rat': { cr: '0', ac: 10, hp: 1, url: 'https://www.dndbeyond.com/monsters/4775917-rat' },
    'Raven': { cr: '0', ac: 12, hp: 1, url: 'https://www.dndbeyond.com/monsters/4775918-raven' },
    'Spider': { cr: '0', ac: 12, hp: 1, url: 'https://www.dndbeyond.com/monsters/4775934-spider' },
    
    // CR 1/8
    'Bandit': { cr: '1/8', ac: 12, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775821-bandit' },
    'Cultist': { cr: '1/8', ac: 12, hp: 9, url: 'https://www.dndbeyond.com/monsters/16835-cultist' },
    'Flying Snake': { cr: '1/8', ac: 14, hp: 5, url: 'https://www.dndbeyond.com/monsters/4775849-flying-snake' },
    'Giant Crab': { cr: '1/8', ac: 15, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775852-giant-crab' },
    'Giant Rat': { cr: '1/8', ac: 12, hp: 7, url: 'https://www.dndbeyond.com/monsters/4775859-giant-rat' },
    'Giant Weasel': { cr: '1/8', ac: 13, hp: 9, url: 'https://www.dndbeyond.com/monsters/4775862-giant-weasel' },
    'Guard': { cr: '1/8', ac: 16, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775866-guard' },
    'Kobold': { cr: '1/8', ac: 12, hp: 5, url: 'https://www.dndbeyond.com/monsters/4775879-kobold' },
    'Mastiff': { cr: '1/8', ac: 12, hp: 5, url: 'https://www.dndbeyond.com/monsters/4775893-mastiff' },
    'Mule': { cr: '1/8', ac: 10, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775897-mule' },
    'Poisonous Snake': { cr: '1/8', ac: 13, hp: 2, url: 'https://www.dndbeyond.com/monsters/4775912-poisonous-snake' },
    'Stirge': { cr: '1/8', ac: 14, hp: 2, url: 'https://www.dndbeyond.com/monsters/4775937-stirge' },
    'Tribal Warrior': { cr: '1/8', ac: 12, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775944-tribal-warrior' },
    
    // CR 1/4
    'Acolyte': { cr: '1/4', ac: 10, hp: 9, url: 'https://www.dndbeyond.com/monsters/4775812-acolyte' },
    'Axe Beak': { cr: '1/4', ac: 11, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775817-axe-beak' },
    'Blink Dog': { cr: '1/4', ac: 13, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775824-blink-dog' },
    'Boar': { cr: '1/4', ac: 11, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775825-boar' },
    'Constrictor Snake': { cr: '1/4', ac: 12, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775836-constrictor-snake' },
    'Dretchling': { cr: '1/4', ac: 11, hp: 18, url: 'https://www.dndbeyond.com/monsters/4775842-dretchling' },
    'Elk': { cr: '1/4', ac: 10, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775846-elk' },
    'Giant Bat': { cr: '1/4', ac: 13, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775850-giant-bat' },
    'Giant Frog': { cr: '1/4', ac: 11, hp: 18, url: 'https://www.dndbeyond.com/monsters/4775851-giant-frog' },
    'Giant Lizard': { cr: '1/4', ac: 12, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775855-giant-lizard' },
    'Giant Owl': { cr: '1/4', ac: 12, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775857-giant-owl' },
    'Giant Poisonous Snake': { cr: '1/4', ac: 14, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775858-giant-poisonous-snake' },
    'Giant Wolf Spider': { cr: '1/4', ac: 13, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775863-giant-wolf-spider' },
    'Goblin': { cr: '1/4', ac: 15, hp: 7, url: 'https://www.dndbeyond.com/monsters/4775864-goblin' },
    'Panther': { cr: '1/4', ac: 12, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775909-panther' },
    'Pteranodon': { cr: '1/4', ac: 13, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775914-pteranodon' },
    'Riding Horse': { cr: '1/4', ac: 10, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775919-riding-horse' },
    'Skeleton': { cr: '1/4', ac: 13, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775927-skeleton' },
    'Swarm of Bats': { cr: '1/4', ac: 12, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775938-swarm-of-bats' },
    'Swarm of Rats': { cr: '1/4', ac: 10, hp: 24, url: 'https://www.dndbeyond.com/monsters/4775940-swarm-of-rats' },
    'Velociraptor': { cr: '1/4', ac: 13, hp: 10, url: 'https://www.dndbeyond.com/monsters/4775947-velociraptor' },
    'Wolf': { cr: '1/4', ac: 13, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775951-wolf' },
    'Zombie': { cr: '1/4', ac: 8, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775952-zombie' },
    
    // CR 1/2
    'Ape': { cr: '1/2', ac: 12, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775813-ape' },
    'Black Bear': { cr: '1/2', ac: 11, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775823-black-bear' },
    'Crocodile': { cr: '1/2', ac: 12, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775838-crocodile' },
    'Giant Goat': { cr: '1/2', ac: 11, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775853-giant-goat' },
    'Giant Sea Horse': { cr: '1/2', ac: 13, hp: 16, url: 'https://www.dndbeyond.com/monsters/4775860-giant-sea-horse' },
    'Giant Wasp': { cr: '1/2', ac: 12, hp: 13, url: 'https://www.dndbeyond.com/monsters/4775861-giant-wasp' },
    'Gnoll': { cr: '1/2', ac: 15, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775862-gnoll' },
    'Hobgoblin': { cr: '1/2', ac: 18, hp: 11, url: 'https://www.dndbeyond.com/monsters/4775867-hobgoblin' },
    'Lizardfolk': { cr: '1/2', ac: 15, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775888-lizardfolk' },
    'Orc': { cr: '1/2', ac: 13, hp: 15, url: 'https://www.dndbeyond.com/monsters/4775905-orc' },
    'Reef Shark': { cr: '1/2', ac: 12, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775918-reef-shark' },
    'Rust Monster': { cr: '1/2', ac: 14, hp: 27, url: 'https://www.dndbeyond.com/monsters/4775920-rust-monster' },
    'Satyr': { cr: '1/2', ac: 14, hp: 31, url: 'https://www.dndbeyond.com/monsters/4775922-satyr' },
    'Scout': { cr: '1/2', ac: 13, hp: 16, url: 'https://www.dndbeyond.com/monsters/4775923-scout' },
    'Shadow': { cr: '1/2', ac: 12, hp: 16, url: 'https://www.dndbeyond.com/monsters/4775925-shadow' },
    'Swarm of Insects': { cr: '1/2', ac: 12, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775939-swarm-of-insects' },
    'Thug': { cr: '1/2', ac: 11, hp: 32, url: 'https://www.dndbeyond.com/monsters/4775943-thug' },
    'Warhorse': { cr: '1/2', ac: 11, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775949-warhorse' },
    'Worg': { cr: '1/2', ac: 13, hp: 26, url: 'https://www.dndbeyond.com/monsters/4775952-worg' },
    
    // CR 1
    'Animated Armor': { cr: '1', ac: 18, hp: 33, url: 'https://www.dndbeyond.com/monsters/4775812-animated-armor' },
    'Brown Bear': { cr: '1', ac: 11, hp: 34, url: 'https://www.dndbeyond.com/monsters/4775826-brown-bear' },
    'Bugbear': { cr: '1', ac: 16, hp: 27, url: 'https://www.dndbeyond.com/monsters/4775827-bugbear' },
    'Death Dog': { cr: '1', ac: 12, hp: 39, url: 'https://www.dndbeyond.com/monsters/4775839-death-dog' },
    'Dire Wolf': { cr: '1', ac: 14, hp: 37, url: 'https://www.dndbeyond.com/monsters/4775841-dire-wolf' },
    'Dryad': { cr: '1', ac: 11, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775843-dryad' },
    'Ghoul': { cr: '1', ac: 12, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775863-ghoul' },
    'Giant Eagle': { cr: '1', ac: 13, hp: 26, url: 'https://www.dndbeyond.com/monsters/4775845-giant-eagle' },
    'Giant Hyena': { cr: '1', ac: 12, hp: 45, url: 'https://www.dndbeyond.com/monsters/4775854-giant-hyena' },
    'Giant Octopus': { cr: '1', ac: 11, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775856-giant-octopus' },
    'Giant Spider': { cr: '1', ac: 14, hp: 26, url: 'https://www.dndbeyond.com/monsters/4775862-giant-spider' },
    'Giant Toad': { cr: '1', ac: 11, hp: 39, url: 'https://www.dndbeyond.com/monsters/4775862-giant-toad' },
    'Giant Vulture': { cr: '1', ac: 10, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775863-giant-vulture' },
    'Harpy': { cr: '1', ac: 11, hp: 38, url: 'https://www.dndbeyond.com/monsters/4775866-harpy' },
    'Hippogriff': { cr: '1', ac: 11, hp: 19, url: 'https://www.dndbeyond.com/monsters/4775867-hippogriff' },
    'Imp': { cr: '1', ac: 13, hp: 10, url: 'https://www.dndbeyond.com/monsters/4775868-imp' },
    'Lion': { cr: '1', ac: 12, hp: 26, url: 'https://www.dndbeyond.com/monsters/4775887-lion' },
    'Quasit': { cr: '1', ac: 13, hp: 7, url: 'https://www.dndbeyond.com/monsters/4775915-quasit' },
    'Specter': { cr: '1', ac: 12, hp: 22, url: 'https://www.dndbeyond.com/monsters/4775933-specter' },
    'Spy': { cr: '1', ac: 12, hp: 27, url: 'https://www.dndbeyond.com/monsters/4775935-spy' },
    'Tiger': { cr: '1', ac: 12, hp: 37, url: 'https://www.dndbeyond.com/monsters/4775942-tiger' },
    
    // CR 2
    'Ankheg': { cr: '2', ac: 14, hp: 39, url: 'https://www.dndbeyond.com/monsters/4775813-ankheg' },
    'Bandit Captain': { cr: '2', ac: 15, hp: 65, url: 'https://www.dndbeyond.com/monsters/4775820-bandit-captain' },
    'Berserker': { cr: '2', ac: 13, hp: 67, url: 'https://www.dndbeyond.com/monsters/4775822-berserker' },
    'Black Dragon Wyrmling': { cr: '2', ac: 17, hp: 33, url: 'https://www.dndbeyond.com/monsters/4775824-black-dragon-wyrmling' },
    'Cult Fanatic': { cr: '2', ac: 13, hp: 33, url: 'https://www.dndbeyond.com/monsters/4775838-cult-fanatic' },
    'Druid': { cr: '2', ac: 11, hp: 27, url: 'https://www.dndbeyond.com/monsters/4775843-druid' },
    'Ettercap': { cr: '2', ac: 13, hp: 44, url: 'https://www.dndbeyond.com/monsters/4775845-ettercap' },
    'Gargoyle': { cr: '2', ac: 15, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775862-gargoyle' },
    'Gelatinous Cube': { cr: '2', ac: 6, hp: 84, url: 'https://www.dndbeyond.com/monsters/4775862-gelatinous-cube' },
    'Ghast': { cr: '2', ac: 13, hp: 36, url: 'https://www.dndbeyond.com/monsters/4775862-ghast' },
    'Giant Boar': { cr: '2', ac: 12, hp: 42, url: 'https://www.dndbeyond.com/monsters/4775851-giant-boar' },
    'Giant Constrictor Snake': { cr: '2', ac: 12, hp: 60, url: 'https://www.dndbeyond.com/monsters/4775852-giant-constrictor-snake' },
    'Giant Elk': { cr: '2', ac: 14, hp: 42, url: 'https://www.dndbeyond.com/monsters/4775854-giant-elk' },
    'Griffon': { cr: '2', ac: 12, hp: 59, url: 'https://www.dndbeyond.com/monsters/4775865-griffon' },
    'Hunter Shark': { cr: '2', ac: 12, hp: 45, url: 'https://www.dndbeyond.com/monsters/4775867-hunter-shark' },
    'Mimic': { cr: '2', ac: 12, hp: 58, url: 'https://www.dndbeyond.com/monsters/4775896-mimic' },
    'Ogre': { cr: '2', ac: 11, hp: 59, url: 'https://www.dndbeyond.com/monsters/4775902-ogre' },
    'Ogre Zombie': { cr: '2', ac: 8, hp: 85, url: 'https://www.dndbeyond.com/monsters/4775904-ogre-zombie' },
    'Polar Bear': { cr: '2', ac: 12, hp: 42, url: 'https://www.dndbeyond.com/monsters/4775913-polar-bear' },
    'Priest': { cr: '2', ac: 13, hp: 27, url: 'https://www.dndbeyond.com/monsters/4775914-priest' },
    'Rhinoceros': { cr: '2', ac: 11, hp: 45, url: 'https://www.dndbeyond.com/monsters/4775919-rhinoceros' },
    'Saber-Toothed Tiger': { cr: '2', ac: 12, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775921-saber-toothed-tiger' },
    'Sea Hag': { cr: '2', ac: 14, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775924-sea-hag' },
    
    // CR 3
    'Ankylosaurus': { cr: '3', ac: 15, hp: 68, url: 'https://www.dndbeyond.com/monsters/4775813-ankylosaurus' },
    'Basilisk': { cr: '3', ac: 12, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775821-basilisk' },
    'Bearded Devil': { cr: '3', ac: 13, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775822-bearded-devil' },
    'Blue Dragon Wyrmling': { cr: '3', ac: 17, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775825-blue-dragon-wyrmling' },
    'Displacer Beast': { cr: '3', ac: 13, hp: 85, url: 'https://www.dndbeyond.com/monsters/4775842-displacer-beast' },
    'Doppelganger': { cr: '3', ac: 14, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775843-doppelganger' },
    'Giant Scorpion': { cr: '3', ac: 15, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775860-giant-scorpion' },
    'Green Hag': { cr: '3', ac: 17, hp: 82, url: 'https://www.dndbeyond.com/monsters/4775864-green-hag' },
    'Hell Hound': { cr: '3', ac: 15, hp: 45, url: 'https://www.dndbeyond.com/monsters/4775867-hell-hound' },
    'Killer Whale': { cr: '3', ac: 12, hp: 90, url: 'https://www.dndbeyond.com/monsters/4775878-killer-whale' },
    'Knight': { cr: '3', ac: 18, hp: 52, url: 'https://www.dndbeyond.com/monsters/4775882-knight' },
    'Manticore': { cr: '3', ac: 14, hp: 68, url: 'https://www.dndbeyond.com/monsters/4775891-manticore' },
    'Minotaur': { cr: '3', ac: 14, hp: 76, url: 'https://www.dndbeyond.com/monsters/4775897-minotaur' },
    'Mummy': { cr: '3', ac: 11, hp: 58, url: 'https://www.dndbeyond.com/monsters/4775898-mummy' },
    'Owlbear': { cr: '3', ac: 13, hp: 59, url: 'https://www.dndbeyond.com/monsters/4775907-owlbear' },
    'Phase Spider': { cr: '3', ac: 13, hp: 32, url: 'https://www.dndbeyond.com/monsters/4775910-phase-spider' },
    'Veteran': { cr: '3', ac: 17, hp: 58, url: 'https://www.dndbeyond.com/monsters/4775948-veteran' },
    'Werewolf': { cr: '3', ac: 11, hp: 58, url: 'https://www.dndbeyond.com/monsters/4775950-werewolf' },
    'Wight': { cr: '3', ac: 14, hp: 45, url: 'https://www.dndbeyond.com/monsters/4775950-wight' },
    'Winter Wolf': { cr: '3', ac: 13, hp: 75, url: 'https://www.dndbeyond.com/monsters/4775951-winter-wolf' },
    'Yeti': { cr: '3', ac: 12, hp: 51, url: 'https://www.dndbeyond.com/monsters/4775952-yeti' },
    
    // CR 4
    'Banshee': { cr: '4', ac: 12, hp: 58, url: 'https://www.dndbeyond.com/monsters/4775820-banshee' },
    'Black Pudding': { cr: '4', ac: 7, hp: 85, url: 'https://www.dndbeyond.com/monsters/4775824-black-pudding' },
    'Cloaker': { cr: '4', ac: 14, hp: 78, url: 'https://www.dndbeyond.com/monsters/4775834-cloaker' },
    'Couatl': { cr: '4', ac: 19, hp: 97, url: 'https://www.dndbeyond.com/monsters/4775837-couatl' },
    'Elephant': { cr: '4', ac: 12, hp: 76, url: 'https://www.dndbeyond.com/monsters/4775846-elephant' },
    'Ettin': { cr: '4', ac: 12, hp: 85, url: 'https://www.dndbeyond.com/monsters/4775845-ettin' },
    'Flameskull': { cr: '4', ac: 13, hp: 40, url: 'https://www.dndbeyond.com/monsters/4775848-flameskull' },
    'Ghost': { cr: '4', ac: 11, hp: 45, url: 'https://www.dndbeyond.com/monsters/4775862-ghost' },
    'Helmed Horror': { cr: '4', ac: 20, hp: 60, url: 'https://www.dndbeyond.com/monsters/4775867-helmed-horror' },
    'Succubus/Incubus': { cr: '4', ac: 15, hp: 66, url: 'https://www.dndbeyond.com/monsters/4775937-succubus-incubus' },
    'Wereboar': { cr: '4', ac: 10, hp: 78, url: 'https://www.dndbeyond.com/monsters/4775949-wereboar' },
    'Weretiger': { cr: '4', ac: 12, hp: 120, url: 'https://www.dndbeyond.com/monsters/4775950-weretiger' },
    
    // CR 5
    'Air Elemental': { cr: '5', ac: 15, hp: 90, url: 'https://www.dndbeyond.com/monsters/4775812-air-elemental' },
    'Bulette': { cr: '5', ac: 17, hp: 94, url: 'https://www.dndbeyond.com/monsters/4775827-bulette' },
    'Earth Elemental': { cr: '5', ac: 17, hp: 126, url: 'https://www.dndbeyond.com/monsters/4775844-earth-elemental' },
    'Fire Elemental': { cr: '5', ac: 13, hp: 102, url: 'https://www.dndbeyond.com/monsters/4775847-fire-elemental' },
    'Flesh Golem': { cr: '5', ac: 9, hp: 93, url: 'https://www.dndbeyond.com/monsters/4775848-flesh-golem' },
    'Giant Crocodile': { cr: '5', ac: 14, hp: 85, url: 'https://www.dndbeyond.com/monsters/4775852-giant-crocodile' },
    'Giant Shark': { cr: '5', ac: 13, hp: 126, url: 'https://www.dndbeyond.com/monsters/4775861-giant-shark' },
    'Gladiator': { cr: '5', ac: 16, hp: 112, url: 'https://www.dndbeyond.com/monsters/4775863-gladiator' },
    'Gorgon': { cr: '5', ac: 19, hp: 114, url: 'https://www.dndbeyond.com/monsters/4775864-gorgon' },
    'Hill Giant': { cr: '5', ac: 13, hp: 105, url: 'https://www.dndbeyond.com/monsters/4775867-hill-giant' },
    'Night Hag': { cr: '5', ac: 17, hp: 112, url: 'https://www.dndbeyond.com/monsters/4775901-night-hag' },
    'Otyugh': { cr: '5', ac: 14, hp: 114, url: 'https://www.dndbeyond.com/monsters/4775906-otyugh' },
    'Red Slaad': { cr: '5', ac: 14, hp: 93, url: 'https://www.dndbeyond.com/monsters/4775918-red-slaad' },
    'Roper': { cr: '5', ac: 20, hp: 93, url: 'https://www.dndbeyond.com/monsters/4775920-roper' },
    'Salamander': { cr: '5', ac: 15, hp: 90, url: 'https://www.dndbeyond.com/monsters/4775921-salamander' },
    'Shambling Mound': { cr: '5', ac: 15, hp: 136, url: 'https://www.dndbeyond.com/monsters/4775926-shambling-mound' },
    'Triceratops': { cr: '5', ac: 13, hp: 95, url: 'https://www.dndbeyond.com/monsters/4775944-triceratops' },
    'Troll': { cr: '5', ac: 15, hp: 84, url: 'https://www.dndbeyond.com/monsters/4775945-troll' },
    'Unicorn': { cr: '5', ac: 12, hp: 67, url: 'https://www.dndbeyond.com/monsters/4775946-unicorn' },
    'Vampire Spawn': { cr: '5', ac: 15, hp: 82, url: 'https://www.dndbeyond.com/monsters/4775947-vampire-spawn' },
    'Water Elemental': { cr: '5', ac: 14, hp: 114, url: 'https://www.dndbeyond.com/monsters/4775949-water-elemental' },
    'Wraith': { cr: '5', ac: 13, hp: 67, url: 'https://www.dndbeyond.com/monsters/4775952-wraith' },
    'Xorn': { cr: '5', ac: 19, hp: 73, url: 'https://www.dndbeyond.com/monsters/4775952-xorn' },
    
    // CR 6-10
    'Cyclops': { cr: '6', ac: 14, hp: 138, url: 'https://www.dndbeyond.com/monsters/4775839-cyclops' },
    'Mage': { cr: '6', ac: 12, hp: 40, url: 'https://www.dndbeyond.com/monsters/4775889-mage' },
    'Medusa': { cr: '6', ac: 15, hp: 127, url: 'https://www.dndbeyond.com/monsters/4775895-medusa' },
    'Wyvern': { cr: '6', ac: 13, hp: 110, url: 'https://www.dndbeyond.com/monsters/4775952-wyvern' },
    'Stone Giant': { cr: '7', ac: 17, hp: 126, url: 'https://www.dndbeyond.com/monsters/4775936-stone-giant' },
    'Young Black Dragon': { cr: '7', ac: 18, hp: 127, url: 'https://www.dndbeyond.com/monsters/4775952-young-black-dragon' },
    'Assassin': { cr: '8', ac: 15, hp: 78, url: 'https://www.dndbeyond.com/monsters/4775816-assassin' },
    'Frost Giant': { cr: '8', ac: 15, hp: 138, url: 'https://www.dndbeyond.com/monsters/4775850-frost-giant' },
    'Hydra': { cr: '8', ac: 15, hp: 172, url: 'https://www.dndbeyond.com/monsters/4775868-hydra' },
    'Young Blue Dragon': { cr: '9', ac: 18, hp: 152, url: 'https://www.dndbeyond.com/monsters/4775952-young-blue-dragon' },
    'Fire Giant': { cr: '9', ac: 18, hp: 162, url: 'https://www.dndbeyond.com/monsters/4775847-fire-giant' },
    'Young Red Dragon': { cr: '10', ac: 18, hp: 178, url: 'https://www.dndbeyond.com/monsters/4775952-young-red-dragon' },
    'Aboleth': { cr: '10', ac: 17, hp: 135, url: 'https://www.dndbeyond.com/monsters/4775811-aboleth' },
    
    // CR 11-15
    'Behir': { cr: '11', ac: 17, hp: 168, url: 'https://www.dndbeyond.com/monsters/4775822-behir' },
    'Horned Devil': { cr: '11', ac: 18, hp: 178, url: 'https://www.dndbeyond.com/monsters/4775867-horned-devil' },
    'Archmage': { cr: '12', ac: 12, hp: 99, url: 'https://www.dndbeyond.com/monsters/4775814-archmage' },
    'Efreeti': { cr: '11', ac: 17, hp: 200, url: 'https://www.dndbeyond.com/monsters/4775845-efreeti' },
    'Beholder': { cr: '13', ac: 18, hp: 180, url: 'https://www.dndbeyond.com/monsters/4775822-beholder' },
    'Adult Black Dragon': { cr: '14', ac: 19, hp: 195, url: 'https://www.dndbeyond.com/monsters/4775811-adult-black-dragon' },
    'Adult Blue Dragon': { cr: '16', ac: 19, hp: 225, url: 'https://www.dndbeyond.com/monsters/4775812-adult-blue-dragon' },
    'Iron Golem': { cr: '16', ac: 20, hp: 210, url: 'https://www.dndbeyond.com/monsters/4775871-iron-golem' },
    
    // CR 17+
    'Adult Red Dragon': { cr: '17', ac: 19, hp: 256, url: 'https://www.dndbeyond.com/monsters/4775813-adult-red-dragon' },
    'Dragon Turtle': { cr: '17', ac: 20, hp: 341, url: 'https://www.dndbeyond.com/monsters/4775843-dragon-turtle' },
    'Ancient Black Dragon': { cr: '21', ac: 22, hp: 367, url: 'https://www.dndbeyond.com/monsters/4775811-ancient-black-dragon' },
    'Lich': { cr: '21', ac: 17, hp: 135, url: 'https://www.dndbeyond.com/monsters/4775886-lich' },
    'Ancient Blue Dragon': { cr: '23', ac: 22, hp: 481, url: 'https://www.dndbeyond.com/monsters/4775812-ancient-blue-dragon' },
    'Ancient Red Dragon': { cr: '24', ac: 22, hp: 546, url: 'https://www.dndbeyond.com/monsters/4775813-ancient-red-dragon' },
    'Tarrasque': { cr: '30', ac: 25, hp: 676, url: 'https://www.dndbeyond.com/monsters/4775941-tarrasque' }
};

// Load monsters from D&D Beyond
async function loadMonsters() {
    if (monstersLoaded) return true;
    
    console.log('Loading monsters from backend proxy...');
    
    // Use backend proxy (bypasses CORS)
    try {
        const response = await fetch('/api/dndbeyond/monsters');
        const data = await response.json();
        
        console.log('Backend response:', data);
        
        if (data.success && data.monsters && Object.keys(data.monsters).length > 0) {
            DND_MONSTERS = data.monsters;
            monstersLoaded = true;
            console.log(`✓ Loaded ${Object.keys(DND_MONSTERS).length} monsters from D&D Beyond`);
            updateAuthButton(true);
            return true;
        } else {
            throw new Error(data.error || 'No monsters returned');
        }
    } catch (error) {
        console.warn('Could not load from D&D Beyond, using fallback library:', error);
        // Use fallback monsters
        DND_MONSTERS = FALLBACK_MONSTERS;
        monstersLoaded = true;
        console.log(`✓ Loaded ${Object.keys(DND_MONSTERS).length} monsters from fallback library`);
        updateAuthButton(false);
        return true;
    }
}

// Update auth button appearance
function updateAuthButton(authenticated) {
    const btn = document.getElementById('authDndBeyondBtn');
    if (btn) {
        if (authenticated) {
            btn.textContent = '✓ D&D Beyond Connected';
            btn.style.background = '#2ecc71';
        } else {
            btn.textContent = '🔒 Connect D&D Beyond';
            btn.style.background = '#e8491d';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check cookie status first
    await checkCookieStatus();
    
    await loadAdventuresList();
    setupEventListeners();
    // Load monsters from D&D Beyond
    loadMonsters();
    
    // Setup monster search live update
    const monsterSearch = document.getElementById('monsterSearch');
    if (monsterSearch) {
        monsterSearch.addEventListener('input', (e) => {
            renderMonsterList(e.target.value);
        });
    }
    
    // Auto-load adventure from URL parameter
    const url = new URL(window.location);
    const adventureName = url.searchParams.get('adventure');
    if (adventureName) {
        // Only auto-load if we have cookies
        if (hasCookies) {
            const select = document.getElementById('adventureSelect');
            select.value = adventureName;
            // Trigger the change event to load the adventure
            await handleAdventureChange({ target: select });
        } else {
            // Redirect to home and show settings
            window.history.replaceState({}, '', '/');
            openSettingsModal();
        }
    }
});

function setupEventListeners() {
    document.getElementById('adventureSelect').addEventListener('change', handleAdventureChange);
    document.getElementById('newAdventureBtn').addEventListener('click', createNewAdventure);
    document.getElementById('deleteAdventureBtn').addEventListener('click', deleteCurrentAdventure);
    document.getElementById('chapterSelect').addEventListener('change', handleChapterChange);
    document.getElementById('chapterNotes').addEventListener('input', handleChapterNotesChange);
    document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);
    document.getElementById('addEncounterBtn').addEventListener('click', addEncounter);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('settingsBtnSelection').addEventListener('click', openSettingsModal);
    
    // Keyboard shortcut for damage tracking (Ctrl+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            e.stopPropagation();
            openDamageModal();
            return false;
        }
    }, true);
}

// Toggle players section
function togglePlayersSection() {
    playersExpanded = !playersExpanded;
    const container = document.getElementById('playersTableContainer');
    const btn = document.getElementById('togglePlayersBtn');
    
    if (playersExpanded) {
        container.style.display = 'block';
        btn.textContent = '▼';
    } else {
        container.style.display = 'none';
        btn.textContent = '▶';
    }
}

// Toggle statistics section
let statsExpanded = false;

function toggleStatsSection() {
    statsExpanded = !statsExpanded;
    const container = document.getElementById('statsContainer');
    const btn = document.getElementById('toggleStatsBtn');
    
    if (statsExpanded) {
        container.style.display = 'block';
        btn.textContent = '▼';
        renderStatistics();
    } else {
        container.style.display = 'none';
        btn.textContent = '▶';
    }
}

function renderStatistics() {
    if (!currentAdventure || !currentAdventure.players || !currentAdventure.encounters) {
        return;
    }
    
    renderInitiativeChart();
    renderCRChart();
    renderDamageChart();
}

function renderInitiativeChart() {
    const ctx = document.getElementById('initiativeChart');
    if (!ctx) return;
    
    // Collect initiative data for each player
    const playerInitiatives = {};
    
    // Initialize for each player
    currentAdventure.players.forEach(player => {
        playerInitiatives[player.name] = [];
    });
    
    // Collect all initiative rolls from encounters that have been started
    currentAdventure.encounters.forEach(encounter => {
        // Only include encounters that have been started or completed
        if (encounter.state === 'started' || encounter.state === 'complete') {
            if (encounter.combatants) {
                encounter.combatants.forEach(combatant => {
                    if (combatant.isPlayer && playerInitiatives[combatant.name] !== undefined) {
                        playerInitiatives[combatant.name].push(combatant.initiative || 0);
                    }
                });
            }
        }
    });
    
    // Find min and max initiative across all players
    let minInit = Infinity;
    let maxInit = -Infinity;
    Object.values(playerInitiatives).forEach(initiatives => {
        if (initiatives.length > 0) {
            minInit = Math.min(minInit, ...initiatives);
            maxInit = Math.max(maxInit, ...initiatives);
        }
    });
    
    // If no data, return early
    if (minInit === Infinity || maxInit === -Infinity) {
        return;
    }
    
    // Count frequency of each initiative value for each player
    const datasets = [];
    const colors = [
        '#e74c3c',  // Red
        '#3498db',  // Blue
        '#2ecc71',  // Green
        '#f39c12',  // Orange
        '#9b59b6',  // Purple
        '#e91e63',  // Pink
        '#00bcd4',  // Cyan
        '#ff5722'   // Deep Orange
    ];
    
    let colorIndex = 0;
    Object.entries(playerInitiatives).forEach(([playerName, initiatives]) => {
        if (initiatives.length === 0) return;
        
        // Count frequency
        const frequency = {};
        initiatives.forEach(init => {
            frequency[init] = (frequency[init] || 0) + 1;
        });
        
        // Create data points for all initiative values from min to max
        const data = [];
        for (let i = minInit; i <= maxInit; i++) {
            data.push({
                x: i,
                y: frequency[i] || 0
            });
        }
        
        const color = colors[colorIndex % colors.length];
        datasets.push({
            label: playerName,
            data: data,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6
        });
        
        colorIndex++;
    });
    
    // Destroy existing chart if it exists
    if (initiativeChart) {
        initiativeChart.destroy();
    }
    
    // Create new chart
    initiativeChart = new Chart(ctx, {
        type: 'bar',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' time(s) at initiative ' + context.parsed.x;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Initiative Score'
                    },
                    ticks: {
                        stepSize: 1
                    },
                    stacked: true
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Count'
                    },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    },
                    beginAtZero: true,
                    stacked: true
                }
            }
        }
    });
}

function renderCRChart() {
    const canvas = document.getElementById('crChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Calculate total CR for each encounter
    const encounterData = [];
    
    currentAdventure.encounters.forEach((encounter, index) => {
        if (!encounter.combatants) return;
        
        let totalCR = 0;
        let encounterName = encounter.name || `Encounter ${index + 1}`;
        
        // Sum up CR values from all monsters (non-players)
        encounter.combatants.forEach(combatant => {
            if (combatant.isPlayer) return;
            
            // Try to get CR from combatant first, then look up in monster list
            let cr = combatant.cr || '';
            
            // If no CR stored, try looking up from monster database
            if (!cr) {
                // Extract base monster name (remove numbering like "Cultist 1" -> "Cultist")
                const baseName = combatant.name.replace(/\s+\d+$/, '');
                const monster = DND_MONSTERS[baseName];
                cr = monster?.cr || '0';
            }
            
            // Convert CR to numeric value
            let crValue = 0;
            if (typeof cr === 'string') {
                // Handle fractional CRs like "1/8", "1/4", "1/2"
                if (cr.includes('/')) {
                    const parts = cr.split('/');
                    crValue = parseInt(parts[0]) / parseInt(parts[1]);
                } else {
                    crValue = parseFloat(cr) || 0;
                }
            } else {
                crValue = cr || 0;
            }
            totalCR += crValue;
        });
        
        encounterData.push({
            x: index + 1,
            y: totalCR,
            label: encounterName,
            state: encounter.state
        });
    });
    
    // Destroy existing chart if it exists
    if (crChart) {
        crChart.destroy();
    }
    
    // Create new chart
    crChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Total Encounter CR',
                data: encounterData,
                borderColor: '#e74c3c',
                backgroundColor: '#e74c3c20',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: encounterData.map(d => d.state === 'complete' ? '#e74c3c' : '#3498db'),
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                segment: {
                    borderColor: ctx => {
                        const curr = ctx.p1DataIndex;
                        return encounterData[curr]?.state === 'complete' ? '#e74c3c' : '#3498db';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return encounterData[context[0].dataIndex].label;
                        },
                        label: function(context) {
                            return 'Total CR: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Encounter Number'
                    },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Challenge Rating'
                    },
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(1);
                        }
                    }
                }
            }
        }
    });
}

function renderDamageChart() {
    const canvas = document.getElementById('damageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Calculate total damage for each encounter
    const encounterData = [];
    
    currentAdventure.encounters.forEach((encounter, index) => {
        if (!encounter.combatants) return;
        
        let totalDamage = 0;
        let encounterName = encounter.name || `Encounter ${index + 1}`;
        
        // Sum up damage dealt to all NPCs (maxHp - finalHp)
        encounter.combatants.forEach(combatant => {
            if (combatant.isPlayer) return;
            
            const maxHp = combatant.maxHp || 0;
            const currentHp = combatant.hp || 0;
            const damageTaken = Math.max(0, maxHp - currentHp);
            totalDamage += damageTaken;
        });
        
        encounterData.push({
            x: index + 1,
            y: totalDamage,
            label: encounterName,
            state: encounter.state
        });
    });
    
    // Destroy existing chart if it exists
    if (damageChart) {
        damageChart.destroy();
    }
    
    // Create new chart
    damageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [{
                label: 'Total Damage Dealt',
                data: encounterData,
                backgroundColor: encounterData.map(d => d.state === 'complete' ? '#2ecc71' : '#95a5a6'),
                borderColor: encounterData.map(d => d.state === 'complete' ? '#27ae60' : '#7f8c8d'),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return encounterData[context[0].dataIndex].label;
                        },
                        label: function(context) {
                            return 'Damage Dealt: ' + context.parsed.y + ' HP';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Encounter Number'
                    },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Total Damage (HP)'
                    },
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Settings Modal
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'flex';
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
}

// Damage Modal
function openDamageModal() {
    // Find an active encounter (started or just any encounter with combatants)
    let activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
    
    // If no started encounter, try to find any encounter with combatants
    if (!activeEncounter) {
        activeEncounter = currentAdventure.encounters?.find(e => e.combatants && e.combatants.length > 0);
    }
    
    if (!activeEncounter || !activeEncounter.combatants || activeEncounter.combatants.length === 0) {
        return; // Only works if there are combatants
    }
    
    const modal = document.getElementById('damageModal');
    if (!modal) {
        return;
    }
    
    const fromSelect = document.getElementById('damageFromSelect');
    const toSelect = document.getElementById('damageToSelect');
    const amountInput = document.getElementById('damageAmount');
    
    // Clear and populate dropdowns
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    activeEncounter.combatants.forEach((combatant, index) => {
        const optionFrom = document.createElement('option');
        optionFrom.value = index;
        optionFrom.textContent = combatant.name;
        fromSelect.appendChild(optionFrom);
        
        const optionTo = document.createElement('option');
        optionTo.value = index;
        optionTo.textContent = combatant.name;
        toSelect.appendChild(optionTo);
    });
    
    // Set default "from" to active combatant
    const activeCombatantIndex = activeEncounter.combatants.findIndex(
        c => c.name === activeEncounter.activeCombatant
    );
    if (activeCombatantIndex >= 0) {
        fromSelect.value = activeCombatantIndex;
    }
    
    amountInput.value = 0;
    modal.style.display = 'flex';
    setTimeout(() => amountInput.focus(), 100);
}

function closeDamageModal() {
    const modal = document.getElementById('damageModal');
    modal.style.display = 'none';
}

function confirmDamage() {
    const activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
    if (!activeEncounter) {
        closeDamageModal();
        return;
    }
    
    const fromIndex = parseInt(document.getElementById('damageFromSelect').value);
    const toIndex = parseInt(document.getElementById('damageToSelect').value);
    const amount = parseInt(document.getElementById('damageAmount').value) || 0;
    
    if (amount <= 0) {
        closeDamageModal();
        return;
    }
    
    // Update the from combatant's DMG
    if (activeEncounter.combatants[fromIndex]) {
        activeEncounter.combatants[fromIndex].dmg = (activeEncounter.combatants[fromIndex].dmg || 0) + amount;
    }
    
    // Update the to combatant's HP
    if (activeEncounter.combatants[toIndex]) {
        activeEncounter.combatants[toIndex].hp = (activeEncounter.combatants[toIndex].hp || 0) - amount;
    }
    
    // Re-render and close
    renderEncounters();
    closeDamageModal();
}

// Check cookie status
async function checkCookieStatus() {
    try {
        const response = await fetch('/api/dndbeyond/cookie-status');
        const result = await response.json();
        hasCookies = result.hasCookies;
        updateUIForCookieStatus();
    } catch (error) {
        console.error('Error checking cookie status:', error);
        hasCookies = false;
        updateUIForCookieStatus();
    }
}

// Update UI based on cookie authentication status
function updateUIForCookieStatus() {
    const adventureSelect = document.getElementById('adventureSelect');
    const newAdventureBtn = document.getElementById('newAdventureBtn');
    const adventureSelectionHeader = document.getElementById('adventureSelectionHeader');
    
    if (!hasCookies) {
        // Disable adventure controls
        adventureSelect.disabled = true;
        newAdventureBtn.disabled = true;
        
        // Add warning message if not already present
        if (!document.getElementById('cookieWarning')) {
            const warning = document.createElement('div');
            warning.id = 'cookieWarning';
            warning.style.cssText = 'background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;';
            warning.innerHTML = `
                <h3 style="margin: 0 0 10px 0; color: #856404;">⚠️ Authentication Required</h3>
                <p style="margin: 0 0 10px 0; color: #856404;">You must configure D&D Beyond cookies before using this app.</p>
                <button onclick="openSettingsModal()" style="background: #9b59b6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    ⚙️ Open Settings to Configure
                </button>
            `;
            adventureSelectionHeader.parentNode.insertBefore(warning, adventureSelectionHeader.nextSibling);
        }
    } else {
        // Enable adventure controls
        adventureSelect.disabled = false;
        newAdventureBtn.disabled = false;
        
        // Remove warning if present
        const warning = document.getElementById('cookieWarning');
        if (warning) {
            warning.remove();
        }
    }
}

async function saveCookies() {
    const cookieInput = document.getElementById('cookieInput');
    const cookieString = cookieInput.value.trim();
    
    if (!cookieString) {
        showCookieStatus('Please paste your cookies first.', 'error');
        return;
    }
    
    // Parse cookie string into object
    const cookies = {};
    cookieString.split(';').forEach(cookie => {
        const [name, ...value] = cookie.trim().split('=');
        if (name) {
            cookies[name] = value.join('=');
        }
    });
    
    try {
        // Send cookies to backend
        const response = await fetch('/api/dndbeyond/set-cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showCookieStatus(`✓ Cookies saved! You can now create adventures and add monsters.`, 'success');
            // Update cookie status and UI
            await checkCookieStatus();
        } else {
            showCookieStatus('Failed to save cookies: ' + result.error, 'error');
        }
    } catch (error) {
        showCookieStatus('Error: ' + error.message, 'error');
    }
}

function clearCookies() {
    if (confirm('Clear saved D&D Beyond cookies? This will prevent you from using the app until you reconfigure.')) {
        fetch('/api/dndbeyond/clear-cookies', { method: 'POST' });
        document.getElementById('cookieInput').value = '';
        showCookieStatus('Cookies cleared. You must reconfigure to use the app.', 'warning');
        
        // Update cookie status and UI
        hasCookies = false;
        updateUIForCookieStatus();
        
        // Reset to fallback
        monstersLoaded = false;
        DND_MONSTERS = {};
        loadMonsters();
    }
}

function showCookieStatus(message, type) {
    const statusDiv = document.getElementById('cookieStatus');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    
    const colors = {
        success: '#d4edda',
        error: '#f8d7da',
        warning: '#fff3cd',
        info: '#d1ecf1'
    };
    
    statusDiv.style.background = colors[type] || colors.info;
    statusDiv.style.color = '#333';
}

// Show toast notification (for monster fetch feedback)
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '14px';
    toast.style.maxWidth = '300px';
    toast.textContent = message;
    
    const colors = {
        success: { bg: '#d4edda', text: '#155724' },
        error: { bg: '#f8d7da', text: '#721c24' },
        warning: { bg: '#fff3cd', text: '#856404' },
        info: { bg: '#d1ecf1', text: '#0c5460' }
    };
    
    const color = colors[type] || colors.info;
    toast.style.background = color.bg;
    toast.style.color = color.text;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}



// Authenticate with D&D Beyond
function authenticateDndBeyond() {
    openSettingsModal();
}

// Load adventures list
async function loadAdventuresList() {
    const response = await fetch('/api/adventures');
    const adventures = await response.json();
    
    const select = document.getElementById('adventureSelect');
    select.innerHTML = '<option value="">-- Select Adventure --</option>';
    
    adventures.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Handle adventure selection
async function handleAdventureChange(e) {
    const name = e.target.value;
    if (!name) {
        document.getElementById('adventureContent').style.display = 'none';
        document.getElementById('adventureSelectionHeader').style.display = 'flex';
        document.getElementById('adventureHeader').style.display = 'none';
        // Clear URL parameter
        const url = new URL(window.location);
        url.searchParams.delete('adventure');
        window.history.pushState({}, '', url);
        return;
    }
    
    // Check if cookies are configured
    if (!hasCookies) {
        alert('You must configure D&D Beyond cookies before loading adventures. Click Settings (⚙️) to set up.');
        openSettingsModal();
        e.target.value = ''; // Reset selection
        return;
    }
    
    const response = await fetch(`/api/adventure/${name}`);
    currentAdventure = await response.json();
    
    // Update header to show adventure title
    document.getElementById('adventureSelectionHeader').style.display = 'none';
    document.getElementById('adventureHeader').style.display = 'flex';
    document.getElementById('adventureTitleText').textContent = currentAdventure.name;
    
    // Initialize chapters if not present
    if (!currentAdventure.chapters) {
        currentAdventure.chapters = ['Chapter 1'];
    }
    if (!currentAdventure.encounters) {
        currentAdventure.encounters = [];
    }
    
    // Ensure all encounters have a chapter
    currentAdventure.encounters.forEach(enc => {
        if (!enc.chapter) {
            enc.chapter = currentAdventure.chapters[0];
        }
    });
    
    // Get chapter from URL or use first chapter
    const urlParams = new URLSearchParams(window.location.search);
    const chapterParam = urlParams.get('chapter');
    if (chapterParam && currentAdventure.chapters.includes(chapterParam)) {
        currentChapter = chapterParam;
    } else {
        currentChapter = currentAdventure.chapters[0];
    }
    
    // Update URL parameters
    const url = new URL(window.location);
    url.searchParams.set('adventure', name);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    renderAdventure();
    document.getElementById('adventureContent').style.display = 'block';
}

// Create new adventure
async function createNewAdventure() {
    // Check if cookies are configured
    if (!hasCookies) {
        alert('You must configure D&D Beyond cookies before creating adventures. Click Settings (⚙️) to set up.');
        openSettingsModal();
        return;
    }
    
    const name = prompt('Enter adventure name:');
    if (!name) return;
    
    const response = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    
    if (response.ok) {
        await loadAdventuresList();
        document.getElementById('adventureSelect').value = name;
        await handleAdventureChange({ target: { value: name } });
    } else {
        const error = await response.json();
        alert(error.error);
    }
}

// Delete current adventure
async function deleteCurrentAdventure() {
    const name = document.getElementById('adventureSelect').value;
    if (!name) return;
    
    if (!confirm(`Delete adventure "${name}"?`)) return;
    
    await fetch(`/api/adventure/${name}`, { method: 'DELETE' });
    await loadAdventuresList();
    document.getElementById('adventureSelect').value = '';
    document.getElementById('adventureContent').style.display = 'none';
    
    // Clear URL parameters
    const url = new URL(window.location);
    url.searchParams.delete('adventure');
    url.searchParams.delete('chapter');
    window.history.pushState({}, '', url);
}

// Handle chapter change
function handleChapterChange(event) {
    currentChapter = event.target.value;
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    // Update chapter notes display
    updateChapterNotesDisplay();
    
    renderEncounters();
}

// Handle chapter notes change
function handleChapterNotesChange(event) {
    if (!currentAdventure.chapterNotes) {
        currentAdventure.chapterNotes = {};
    }
    currentAdventure.chapterNotes[currentChapter] = event.target.value;
    autoSave();
}

// Update chapter notes display
function updateChapterNotesDisplay() {
    const notesTextarea = document.getElementById('chapterNotes');
    if (notesTextarea) {
        notesTextarea.value = (currentAdventure.chapterNotes && currentAdventure.chapterNotes[currentChapter]) || '';
    }
}

// Add new chapter
function addChapter() {
    const name = prompt('Enter chapter name:');
    if (!name) return;
    
    if (currentAdventure.chapters.includes(name)) {
        alert('A chapter with this name already exists.');
        return;
    }
    
    currentAdventure.chapters.push(name);
    currentChapter = name;
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    renderAdventure();
    autoSave();
}

// Delete current chapter
function deleteChapter() {
    if (currentAdventure.chapters.length === 1) {
        alert('Cannot delete the last chapter.');
        return;
    }
    
    if (!confirm(`Delete chapter "${currentChapter}" and all its encounters? This cannot be undone.`)) {
        return;
    }
    
    // Remove encounters in this chapter
    currentAdventure.encounters = currentAdventure.encounters.filter(enc => enc.chapter !== currentChapter);
    
    // Remove chapter
    currentAdventure.chapters = currentAdventure.chapters.filter(ch => ch !== currentChapter);
    
    // Switch to first chapter
    currentChapter = currentAdventure.chapters[0];
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    renderAdventure();
    autoSave();
}

// Render adventure
function renderAdventure() {
    renderChapterSelector();
    updateChapterNotesDisplay();
    renderPlayers();
    renderEncounters();
}

// Render chapter selector
function renderChapterSelector() {
    const selector = document.getElementById('chapterSelect');
    selector.innerHTML = currentAdventure.chapters.map(chapter => 
        `<option value="${chapter}" ${chapter === currentChapter ? 'selected' : ''}>${chapter}</option>`
    ).join('');
}

// Render players table
function sortPlayers(field) {
    if (!currentAdventure.players || currentAdventure.players.length === 0) return;
    
    currentAdventure.players.sort((a, b) => {
        let aVal, bVal;
        
        // Handle special calculated fields
        if (field === 'passivePerception') {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const aProfBonus = 2 + Math.floor(((a.level || 1) - 1) / 4);
            const bProfBonus = 2 + Math.floor(((b.level || 1) - 1) / 4);
            const aWisMod = calcMod(a.abilityScores?.wis || 10);
            const bWisMod = calcMod(b.abilityScores?.wis || 10);
            aVal = 10 + aWisMod + (a.skillProficiencies?.perception ? aProfBonus : 0);
            bVal = 10 + bWisMod + (b.skillProficiencies?.perception ? bProfBonus : 0);
        } else if (field === 'passiveInvestigation') {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const aProfBonus = 2 + Math.floor(((a.level || 1) - 1) / 4);
            const bProfBonus = 2 + Math.floor(((b.level || 1) - 1) / 4);
            const aIntMod = calcMod(a.abilityScores?.int || 10);
            const bIntMod = calcMod(b.abilityScores?.int || 10);
            aVal = 10 + aIntMod + (a.skillProficiencies?.investigation ? aProfBonus : 0);
            bVal = 10 + bIntMod + (b.skillProficiencies?.investigation ? bProfBonus : 0);
        } else if (field === 'passiveInsight') {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const aProfBonus = 2 + Math.floor(((a.level || 1) - 1) / 4);
            const bProfBonus = 2 + Math.floor(((b.level || 1) - 1) / 4);
            const aWisMod = calcMod(a.abilityScores?.wis || 10);
            const bWisMod = calcMod(b.abilityScores?.wis || 10);
            aVal = 10 + aWisMod + (a.skillProficiencies?.insight ? aProfBonus : 0);
            bVal = 10 + bWisMod + (b.skillProficiencies?.insight ? bProfBonus : 0);
        } else {
            aVal = a[field];
            bVal = b[field];
        }
        
        // Handle undefined/null values
        if (aVal === undefined || aVal === null) aVal = '';
        if (bVal === undefined || bVal === null) bVal = '';
        
        // For numeric fields, sort largest to smallest
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return bVal - aVal;  // Descending order
        }
        
        // For string fields, sort alphabetically (A-Z)
        return String(aVal).localeCompare(String(bVal));
    });
    
    renderPlayers();
    autoSave();
}

function renderPlayers() {
    const tbody = document.getElementById('playersBody');
    tbody.innerHTML = '';
    
    if (!currentAdventure.players) {
        currentAdventure.players = [];
    }
    
    currentAdventure.players.forEach((player, index) => {
        const classOptions = DND_CLASSES.map(c => `<option value="${c}" ${player.class === c ? 'selected' : ''}>${c}</option>`).join('');
        const raceOptions = DND_RACES.map(r => `<option value="${r}" ${player.race === r ? 'selected' : ''}>${r}</option>`).join('');
        
        // Initialize abilities if not present
        if (!player.abilityScores) {
            player.abilityScores = {
                str: 10,
                dex: 10,
                con: 10,
                int: 10,
                wis: 10,
                cha: 10
            };
        }
        
        // Initialize skill proficiencies if not present
        if (!player.skillProficiencies) {
            player.skillProficiencies = {
                perception: false,
                insight: false,
                investigation: false
            };
        }
        
        // Calculate ability modifiers
        const calcMod = (score) => Math.floor((score - 10) / 2);
        const wisMod = calcMod(player.abilityScores.wis || 10);
        const intMod = calcMod(player.abilityScores.int || 10);
        
        // Calculate proficiency bonus based on level
        const profBonus = 2 + Math.floor(((player.level || 1) - 1) / 4);
        
        // Calculate passive values (10 + modifier + proficiency if proficient)
        const passivePerception = 10 + wisMod + (player.skillProficiencies.perception ? profBonus : 0);
        const passiveInsight = 10 + wisMod + (player.skillProficiencies.insight ? profBonus : 0);
        const passiveInvestigation = 10 + intMod + (player.skillProficiencies.investigation ? profBonus : 0);
        
        // Track expanded state
        if (player.expanded === undefined) {
            player.expanded = false;
        }
        
        // Main row
        const row = tbody.insertRow();
        row.id = `player-row-${index}`;
        
        if (playersEditMode) {
            // Edit mode: show input fields
            row.innerHTML = `
                <td><button class="btn-small" onclick="togglePlayerStats(${index})" style="background: #95a5a6;" title="Show/hide ability scores">${player.expanded ? '▼' : '▶'}</button></td>
                <td><button class="btn-small" onclick="editPlayerUrl(${index})" style="background: #3498db;" title="Edit D&D Beyond URL">🔗</button></td>
                <td><input type="text" value="${player.playerName || ''}" onchange="updatePlayer(${index}, 'playerName', this.value)" style="width: 90px;"></td>
                <td><input type="text" value="${player.name || ''}" onchange="updatePlayer(${index}, 'name', this.value)" style="width: 100px;"></td>
                <td><select onchange="updatePlayer(${index}, 'race', this.value)" style="width: 110px;"><option value="">Select Race</option>${raceOptions}</select></td>
                <td><select onchange="updatePlayer(${index}, 'class', this.value)" style="width: 110px;"><option value="">Select Class</option>${classOptions}</select></td>
                <td><input type="number" value="${player.level || 1}" onchange="updatePlayer(${index}, 'level', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td><input type="number" value="${player.maxHp || 0}" onchange="updatePlayer(${index}, 'maxHp', parseInt(this.value))" style="width: 45px; text-align: center;"></td>
                <td><input type="number" value="${player.ac || 10}" onchange="updatePlayer(${index}, 'ac', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td><input type="number" value="${player.speed || 30}" onchange="updatePlayer(${index}, 'speed', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td><input type="number" value="${player.initiativeBonus || 0}" onchange="updatePlayer(${index}, 'initiativeBonus', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.perception ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.perception ? ' + Prof(+' + profBonus + ')' : ''}">${passivePerception}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.investigation ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + INT(${intMod >= 0 ? '+' : ''}${intMod})${player.skillProficiencies.investigation ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInvestigation}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.insight ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.insight ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInsight}</span></td>
                <td style="width: 150px;"><input type="text" value="${player.notes || ''}" onchange="updatePlayer(${index}, 'notes', this.value)" style="width: 150px;"></td>
                <td><button class="btn-small" onclick="removePlayer(${index})" style="background: #e74c3c;" title="Delete this player">×</button></td>
            `;
        } else {
            // View mode: show read-only display
            const hasUrl = player.dndBeyondUrl && player.dndBeyondUrl.trim() !== '';
            row.innerHTML = `
                <td><button class="btn-small" onclick="togglePlayerStats(${index})" style="background: #95a5a6;" title="Show/hide ability scores">${player.expanded ? '▼' : '▶'}</button></td>
                <td>${hasUrl ? `<a href="${player.dndBeyondUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 4px 8px; font-size: 16px; background: #3498db; color: white; text-decoration: none; border-radius: 3px; cursor: pointer;" title="Open in D&D Beyond">🔗</a>` : '<span style="display: inline-block; padding: 4px 8px; font-size: 16px; color: #ccc;">🔗</span>'}</td>
                <td style="padding: 8px;">${player.playerName || '—'}</td>
                <td style="padding: 8px; font-weight: 500;">${player.name || '—'}</td>
                <td style="padding: 8px;">${player.race || '—'}</td>
                <td style="padding: 8px;">${player.class || '—'}</td>
                <td style="text-align: center; padding: 8px;">${player.level || 1}</td>
                <td style="text-align: center; padding: 8px;">${player.maxHp || 0}</td>
                <td style="text-align: center; padding: 8px;">${player.ac || 10}</td>
                <td style="text-align: center; padding: 8px;">${player.speed || 30}</td>
                <td style="text-align: center; padding: 8px;">${player.initiativeBonus >= 0 ? '+' : ''}${player.initiativeBonus || 0}</td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.perception ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.perception ? ' + Prof(+' + profBonus + ')' : ''}">${passivePerception}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.investigation ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + INT(${intMod >= 0 ? '+' : ''}${intMod})${player.skillProficiencies.investigation ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInvestigation}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.insight ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.insight ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInsight}</span></td>
                <td style="padding: 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${player.notes || ''}">${player.notes || '—'}</td>
                <td></td>
            `;
        }
        
        // Ability scores row (expandable)
        const detailRow = tbody.insertRow();
        detailRow.id = `player-detail-${index}`;
        detailRow.style.display = player.expanded ? 'table-row' : 'none';
        detailRow.style.backgroundColor = '#f8f9fa';
        
        if (playersEditMode) {
            // Edit mode: show input fields and checkboxes
            detailRow.innerHTML = `
                <td colspan="2"></td>
                <td colspan="14" style="padding: 10px;">
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <div>
                            <strong style="color: #666;">Ability Scores:</strong>
                            <div style="display: flex; gap: 10px; margin-top: 5px;">
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">STR</label>
                                    <input type="number" value="${player.abilityScores.str || 10}" onchange="updatePlayerAbility(${index}, 'str', parseInt(this.value))" style="width: 45px; text-align: center;" title="Strength">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.str || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.str || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">DEX</label>
                                    <input type="number" value="${player.abilityScores.dex || 10}" onchange="updatePlayerAbility(${index}, 'dex', parseInt(this.value))" style="width: 45px; text-align: center;" title="Dexterity">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.dex || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.dex || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CON</label>
                                    <input type="number" value="${player.abilityScores.con || 10}" onchange="updatePlayerAbility(${index}, 'con', parseInt(this.value))" style="width: 45px; text-align: center;" title="Constitution">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.con || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.con || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">INT</label>
                                    <input type="number" value="${player.abilityScores.int || 10}" onchange="updatePlayerAbility(${index}, 'int', parseInt(this.value))" style="width: 45px; text-align: center;" title="Intelligence">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.int || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.int || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">WIS</label>
                                    <input type="number" value="${player.abilityScores.wis || 10}" onchange="updatePlayerAbility(${index}, 'wis', parseInt(this.value))" style="width: 45px; text-align: center;" title="Wisdom">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.wis || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.wis || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CHA</label>
                                    <input type="number" value="${player.abilityScores.cha || 10}" onchange="updatePlayerAbility(${index}, 'cha', parseInt(this.value))" style="width: 45px; text-align: center;" title="Charisma">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.cha || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.cha || 10)}</span>
                                </div>
                            </div>
                        </div>
                        <div style="border-left: 1px solid #ddd; padding-left: 20px;">
                            <strong style="color: #666;">Skill Proficiencies:</strong>
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" ${player.skillProficiencies.perception ? 'checked' : ''} onchange="updatePlayerSkillProf(${index}, 'perception', this.checked)">
                                    <span style="font-size: 13px;">Perception (WIS)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" ${player.skillProficiencies.investigation ? 'checked' : ''} onchange="updatePlayerSkillProf(${index}, 'investigation', this.checked)">
                                    <span style="font-size: 13px;">Investigation (INT)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" ${player.skillProficiencies.insight ? 'checked' : ''} onchange="updatePlayerSkillProf(${index}, 'insight', this.checked)">
                                    <span style="font-size: 13px;">Insight (WIS)</span>
                                </label>
                            </div>
                        </div>
                        <div style="margin-left: auto; color: #999; font-size: 12px;">
                            Proficiency Bonus: +${profBonus}
                        </div>
                    </div>
                </td>
            </tr>
            `;
        } else {
            // View mode: show read-only display with formatted modifiers
            detailRow.innerHTML = `
                <td colspan="2"></td>
                <td colspan="14" style="padding: 10px;">
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <div>
                            <strong style="color: #666;">Ability Scores:</strong>
                            <div style="display: flex; gap: 10px; margin-top: 5px;">
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">STR</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.str || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.str || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.str || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">DEX</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.dex || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.dex || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.dex || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CON</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.con || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.con || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.con || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">INT</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.int || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.int || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.int || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">WIS</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.wis || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.wis || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.wis || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CHA</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.cha || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.cha || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.cha || 10)}</span>
                                </div>
                            </div>
                        </div>
                        <div style="border-left: 1px solid #ddd; padding-left: 20px;">
                            <strong style="color: #666;">Skill Proficiencies:</strong>
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 13px; color: ${player.skillProficiencies.perception ? '#27ae60' : '#999'};">${player.skillProficiencies.perception ? '✓' : '—'} Perception (WIS)</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 13px; color: ${player.skillProficiencies.investigation ? '#27ae60' : '#999'};">${player.skillProficiencies.investigation ? '✓' : '—'} Investigation (INT)</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 13px; color: ${player.skillProficiencies.insight ? '#27ae60' : '#999'};">${player.skillProficiencies.insight ? '✓' : '—'} Insight (WIS)</span>
                                </div>
                            </div>
                        </div>
                        <div style="margin-left: auto; color: #999; font-size: 12px;">
                            Proficiency Bonus: +${profBonus}
                        </div>
                    </div>
                </td>
            </tr>
            `;
        }
    });
}

// Toggle player ability scores visibility
function togglePlayerStats(index) {
    currentAdventure.players[index].expanded = !currentAdventure.players[index].expanded;
    renderPlayers();
    autoSave();
}

// Toggle players edit mode
function togglePlayersEditMode() {
    playersEditMode = !playersEditMode;
    const btn = document.getElementById('toggleEditPlayersBtn');
    const addBtn = document.getElementById('addPlayerBtn');
    if (playersEditMode) {
        btn.textContent = '💾';
        btn.title = 'Save';
        btn.style.background = '#27ae60';
        addBtn.style.display = 'block';
    } else {
        btn.textContent = '✏️';
        btn.title = 'Edit';
        btn.style.background = '#f39c12';
        addBtn.style.display = 'none';
    }
    renderPlayers();
}

// Update player skill proficiency
function updatePlayerSkillProf(index, skill, isProficient) {
    if (!currentAdventure.players[index].skillProficiencies) {
        currentAdventure.players[index].skillProficiencies = {
            perception: false,
            insight: false,
            investigation: false
        };
    }
    currentAdventure.players[index].skillProficiencies[skill] = isProficient;
    renderPlayers(); // Re-render to update passive values
    autoSave();
}

// Update player
function updatePlayer(index, field, value) {
    currentAdventure.players[index][field] = value;
    autoSave();
}

// Update player ability score
function updatePlayerAbility(index, ability, value) {
    if (!currentAdventure.players[index].abilityScores) {
        currentAdventure.players[index].abilityScores = {
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
        };
    }
    currentAdventure.players[index].abilityScores[ability] = value;
    renderPlayers(); // Re-render to show updated modifiers
    autoSave();
}

// Toggle player stats expanded/collapsed
function togglePlayerStats(index) {
    currentAdventure.players[index].expanded = !currentAdventure.players[index].expanded;
    renderPlayers();
}

// Edit player D&D Beyond URL
function editPlayerUrl(index) {
    const player = currentAdventure.players[index];
    const url = prompt('Enter D&D Beyond URL for ' + player.name + ':', player.dndBeyondUrl || '');
    if (url !== null) {
        currentAdventure.players[index].dndBeyondUrl = url;
        renderPlayers();
        autoSave();
    }
}

// Add new player
function addPlayer() {
    currentAdventure.players.push({
        name: '',
        playerName: '',
        race: '',
        class: '',
        level: 1,
        abilityScores: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        },
        skillProficiencies: {
            perception: false,
            insight: false,
            investigation: false
        },
        maxHp: 0,
        ac: 10,
        speed: 30,
        initiativeBonus: 0,
        notes: '',
        expanded: false
    });
    renderPlayers();
    autoSave();
}

// Remove player
function removePlayer(index) {
    if (confirm('Remove this player?')) {
        currentAdventure.players.splice(index, 1);
        renderPlayers();
        autoSave();
    }
}

// Check if combatant is a player
function isPlayerCombatant(combatant) {
    if (combatant.isPlayer !== undefined) return combatant.isPlayer;
    // Check if name matches any player
    return currentAdventure.players.some(p => p.name === combatant.name);
}

// Render encounters
// Drag and drop state
let draggedEncounterIndex = null;
let dropTargetIndex = null;

function handleDragStart(e) {
    draggedEncounterIndex = parseInt(e.currentTarget.dataset.encounterIndex);
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    const targetIndex = parseInt(e.currentTarget.dataset.encounterIndex);
    
    if (draggedEncounterIndex !== null && draggedEncounterIndex !== targetIndex) {
        dropTargetIndex = targetIndex;
    }
    
    return false;
}

function handleDragEnd(e) {
    if (draggedEncounterIndex !== null && dropTargetIndex !== null && draggedEncounterIndex !== dropTargetIndex) {
        // Reorder the encounters array
        const draggedEncounter = currentAdventure.encounters[draggedEncounterIndex];
        currentAdventure.encounters.splice(draggedEncounterIndex, 1);
        
        // Calculate new insertion index
        const newIndex = draggedEncounterIndex < dropTargetIndex ? dropTargetIndex - 1 : dropTargetIndex;
        currentAdventure.encounters.splice(newIndex, 0, draggedEncounter);
        
        // Re-render immediately
        renderEncounters();
    } else if (e.currentTarget) {
        e.currentTarget.style.opacity = '1';
    }
    
    draggedEncounterIndex = null;
    dropTargetIndex = null;
}

function renderEncounters() {
    const container = document.getElementById('encountersContainer');
    container.innerHTML = '';
    
    if (!currentAdventure.encounters) {
        currentAdventure.encounters = [];
    }
    
    // Filter encounters by current chapter
    const chapterEncounters = currentAdventure.encounters
        .map((encounter, index) => ({ encounter, index }))
        .filter(({ encounter }) => encounter.chapter === currentChapter);
    
    chapterEncounters.forEach(({ encounter, index }) => {
        // Set default minimized state: minimized unless encounter is started
        if (encounter.minimized === undefined) {
            encounter.minimized = encounter.state !== 'started';
        }
        const card = createEncounterCard(encounter, index);
        
        // Set background color for completed encounters
        if (encounter.state === 'complete') {
            card.style.backgroundColor = '#e8f5e9'; // Light green background
        }
        
        container.appendChild(card);
    });
}

// Calculate total XP for an encounter
function calculateEncounterXP(encounter) {
    if (!encounter.combatants) return 0;
    
    const totalXP = encounter.combatants
        .filter(combatant => !isPlayerCombatant(combatant))
        .reduce((sum, combatant) => {
            // Try to get CR from combatant first, then look up in monster list
            let cr = combatant.cr || '';
            
            // If no CR stored, try looking up from monster database
            if (!cr) {
                // Extract base monster name (remove numbering like "Cultist 1" -> "Cultist")
                const baseName = combatant.name.replace(/\s+\d+$/, '');
                const monster = DND_MONSTERS[baseName];
                cr = monster?.cr || '';
            }
            
            const xp = CR_TO_XP[cr] || 0;
            return sum + xp;
        }, 0);
    
    return totalXP.toLocaleString();
}

function calculateEncounterCR(encounter) {
    if (!encounter.combatants) return '0';
    
    const totalCR = encounter.combatants
        .filter(combatant => !isPlayerCombatant(combatant))
        .reduce((sum, combatant) => {
            // Try to get CR from combatant first, then look up in monster list
            let cr = combatant.cr || '';
            
            // If no CR stored, try looking up from monster database
            if (!cr) {
                // Extract base monster name (remove numbering like "Cultist 1" -> "Cultist")
                const baseName = combatant.name.replace(/\s+\d+$/, '');
                const monster = DND_MONSTERS[baseName];
                cr = monster?.cr || '0';
            }
            
            // Convert CR to numeric value
            if (cr === '1/8') return sum + 0.125;
            else if (cr === '1/4') return sum + 0.25;
            else if (cr === '1/2') return sum + 0.5;
            else return sum + (parseFloat(cr) || 0);
        }, 0);
    
    // Format the total CR nicely
    if (totalCR === 0) return '0';
    if (totalCR < 1) return totalCR.toFixed(2).replace(/\.?0+$/, ''); // Remove trailing zeros
    if (totalCR % 1 === 0) return totalCR.toString(); // Whole number
    return totalCR.toFixed(1); // One decimal place
}

// Create encounter card
function createEncounterCard(encounter, encounterIndex) {
    const card = document.createElement('div');
    card.className = 'encounter-card';
    card.draggable = true;
    card.dataset.encounterIndex = encounterIndex;
    
    // Drag and drop event handlers
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
    
    const header = document.createElement('div');
    header.className = 'encounter-header';
    
    // Determine which buttons to show based on encounter state
    let encounterButtons = '';
    if (encounter.state === 'started') {
        // Encounter is active - show Next Turn and End
        encounterButtons = `
            <button class="btn-small" onclick="nextTurn(${encounterIndex})" title="Advance to next turn">Next Turn</button>
            <button class="btn-small" onclick="endEncounter(${encounterIndex})" style="background: #e74c3c;" title="End encounter">End</button>
        `;
    } else if (encounter.state === 'complete') {
        // Encounter ended - show Reset button
        encounterButtons = `
            <button class="btn-small" onclick="resetEncounter(${encounterIndex})" style="background: #ff9800;" title="Reset encounter to unstarted state">Reset</button>
        `;
    } else {
        // Encounter not started - show Start button
        encounterButtons = `
            <button class="btn-small" onclick="startEncounter(${encounterIndex})" style="background: #2ecc71;" title="Start encounter and sort by initiative">Start</button>
        `;
    }
    
    const minimizeIcon = encounter.minimized ? '▶' : '▼';
    
    // Show encounter controls only if not started or completed
    const showControls = !encounter.state || encounter.state === 'unstarted';
    
    header.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <button class="btn-small" onclick="toggleEncounterMinimize(${encounterIndex})" title="${encounter.minimized ? 'Expand' : 'Minimize'}" style="background: #95a5a6;">${minimizeIcon}</button>
                    ${showControls ? `
                        <input type="text" class="encounter-title" value="${encounter.name || 'New Encounter'}" 
                               onchange="updateEncounterName(${encounterIndex}, this.value)" style="border: 1px solid #ddd; padding: 5px; width: 280px; max-width: 280px;">
                    ` : `
                        <span class="encounter-title" style="font-size: 20px; font-weight: 600; width: 280px; max-width: 280px;">${encounter.name || 'New Encounter'}</span>
                    `}
                    <span style="color: #666; font-size: 14px; font-weight: 500; white-space: nowrap; margin-left: 10px;">CR: ${calculateEncounterCR(encounter)} | XP: ${calculateEncounterXP(encounter)}</span>
                </div>
                <div class="encounter-controls">
                    ${showControls ? `
                        <button class="btn-small" onclick="addMonsterFromLibrary(${encounterIndex})" style="background: #27ae60;" title="Add a monster to this encounter">+</button>
                        <button class="btn-small" onclick="refreshPlayers(${encounterIndex})" style="background: #3498db;" title="Refresh player stats from Players section">↻</button>
                    ` : ''}
                    ${showControls ? `
                        <button class="btn-small" onclick="removeEncounter(${encounterIndex})" style="background: #e74c3c;" title="Delete this encounter">×</button>
                    ` : ''}
                </div>
            </div>
            <div style="display: ${encounter.minimized ? 'none' : 'flex'}; align-items: center; gap: 15px;">
                <span style="color: #666; font-weight: 500;">Round ${encounter.currentRound || 1}</span>
                <div class="encounter-controls">
                    ${encounterButtons}
                </div>
            </div>
        </div>
    `;
    card.appendChild(header);
    
    // Combatants table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    if (encounter.minimized) {
        tableContainer.style.display = 'none';
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th style="width: 30px;">Turn</th>
                <th style="width: 120px;">Name</th>
                <th style="width: 60px; text-align: center;">CR</th>
                <th style="width: 50px; text-align: center;">Init</th>
                <th style="width: 60px; text-align: center;">AC</th>
                <th style="width: 68px; text-align: center;">MaxHP</th>
                <th style="width: 68px; text-align: center;">HP</th>
                <th style="width: 68px; text-align: center;">DMG</th>
                <th style="width: 68px; text-align: center;">Heal</th>
                <th>Notes</th>
                <th style="width: 40px;"></th>
            </tr>
        </thead>
        <tbody id="combatants-${encounterIndex}"></tbody>
    `;
    
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    
    // Render combatants
    const tbody = table.querySelector('tbody');
    if (!encounter.combatants) encounter.combatants = [];
    
    encounter.combatants.forEach((combatant, combatantIndex) => {
        const row = tbody.insertRow();
        const isPlayer = isPlayerCombatant(combatant);
        const isActive = encounter.state === 'started' && encounter.activeCombatant === combatant.name;
        row.className = isActive ? 'combatant-row active' : 'combatant-row';
        
        // Look up details from player list or monster list
        let ac = combatant.ac || 10;
        let cr = combatant.cr || '';
        let dndBeyondUrl = combatant.dndBeyondUrl || '';
        
        if (isPlayer) {
            // Look up player details from players array
            const player = currentAdventure.players?.find(p => p.name === combatant.name);
            if (player) {
                ac = player.ac || 10;
                dndBeyondUrl = player.dndBeyondUrl || '';
            }
        } else {
            // Look up monster details from DND_MONSTERS (only if not already saved on combatant)
            const baseName = combatant.name.split(' ')[0]; // Get base name (e.g., "Cultist" from "Cultist 2")
            const monster = DND_MONSTERS[baseName];
            if (monster) {
                // Only use dictionary values if combatant doesn't have them saved
                if (!combatant.ac) {
                    ac = monster.ac || 10;
                }
                if (!combatant.cr) {
                    cr = monster.cr || '';
                }
                if (!combatant.dndBeyondUrl) {
                    dndBeyondUrl = monster.url || '';
                }
            }
        }
        
        // Apply player background only if not active
        if (isPlayer && !isActive) {
            row.style.background = '#e8f4f8';
        }
        
        // Determine name display (clickable link or input)
        let nameHTML;
        const isUnconscious = (combatant.hp || 0) <= 0;
        const textColor = isUnconscious ? '#e74c3c' : '#2c5aa0';
        const inheritColor = isUnconscious ? '#e74c3c' : 'inherit';
        
        if (isPlayer) {
            // Players: always show tooltip with player data, link to URL if available
            const escapedName = combatant.name.replace(/'/g, "\\'");
            const escapedUrl = dndBeyondUrl ? dndBeyondUrl.replace(/'/g, "\\'") : '';
            const playerUrl = escapedUrl || `player:${escapedName}`; // Use special identifier for local player data
            
            if (dndBeyondUrl) {
                nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                    class="monster-name-hover" 
                    onmouseenter="showMonsterTooltip('${escapedName}', '${playerUrl}', event)"
                    onmouseleave="hideMonsterTooltip()">${combatant.name || ''}</a>`;
            } else {
                nameHTML = `<span style="font-weight: 500; color: ${inheritColor}; cursor: help;" 
                    class="monster-name-hover"
                    onmouseenter="showMonsterTooltip('${escapedName}', '${playerUrl}', event)"
                    onmouseleave="hideMonsterTooltip()">${combatant.name || ''}</span>`;
            }
        } else if (dndBeyondUrl) {
            // NPCs/Monsters with URL: Make name a clickable link with tooltip
            const escapedUrl = dndBeyondUrl.replace(/'/g, "\\'");
            nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                class="monster-name-hover" 
                onmouseenter="showMonsterTooltip('${combatant.name.replace(/'/g, "\\'")}', '${escapedUrl}', event)"
                onmouseleave="hideMonsterTooltip()">${combatant.name || ''}</a>`;
        } else {
            // Monsters without URLs
            nameHTML = `<span style="font-weight: 500; color: ${inheritColor};">${combatant.name || ''}</span>`;
        }
        
        row.innerHTML = `
            <td style="text-align: center;">${(encounter.state === 'started' && encounter.activeCombatant === combatant.name) ? '▶' : ''}</td>
            <td>${nameHTML}</td>
            <td style="text-align: center;">${isPlayer ? '<span style="color: #999;">-</span>' : `<span style="color: #666; font-weight: 500;">${cr}</span>`}</td>
            <td style="text-align: center;">${!encounter.state ? `<input type="number" value="${combatant.initiative || 0}" style="text-align: center;" onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'initiative', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${combatant.initiative || 0}</span>`}</td>
            <td style="text-align: center;"><span style="color: #666; font-weight: 500;">${ac}</span></td>
            <td style="text-align: center;">${!encounter.state ? `<input type="number" value="${combatant.maxHp || 0}" style="text-align: center; width: 100%;" onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'maxHp', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${combatant.maxHp || 0}</span>`}</td>
            <td style="text-align: center;">${encounter.state === 'complete' ? `<span style="color: ${(combatant.hp || 0) <= 0 ? '#e74c3c' : '#666'}; font-weight: 500;">${combatant.hp || 0}</span>` : `<input type="number" class="hp-input" value="${combatant.hp || 0}" style="width: 100%; text-align: center; box-sizing: border-box; padding-left: 12px; padding-right: 0;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'hp', parseInt(this.value))">`}</td>
            <td style="text-align: center;">${encounter.state === 'complete' ? `<span style="color: #666; font-weight: 500;">${combatant.dmg || 0}</span>` : `<input type="number" class="dmg-input" value="${combatant.dmg || 0}" style="width: 100%; text-align: center; box-sizing: border-box; padding-left: 12px; padding-right: 0;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'dmg', parseInt(this.value))">`}</td>
            <td style="text-align: center;">${encounter.state === 'complete' ? `<span style="color: #666; font-weight: 500;">${combatant.heal || 0}</span>` : `<input type="number" class="heal-input" value="${combatant.heal || 0}" style="width: 100%; text-align: center; box-sizing: border-box; padding-left: 12px; padding-right: 0;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'heal', parseInt(this.value))">`}</td>
            <td><input type="text" value="${combatant.notes || ''}" 
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'notes', this.value)"></td>
            <td>${showControls ? `<button class="btn-small" onclick="removeCombatant(${encounterIndex}, ${combatantIndex})" style="background: #e74c3c;" title="Delete this combatant">×</button>` : ''}</td>
        `;
    });
    
    // Treasure section (always shown at the end)
    if (!encounter.minimized) {
        const treasureDiv = document.createElement('div');
        treasureDiv.className = 'treasure-section';
        treasureDiv.style.cssText = 'background: #fff8dc; border: 2px solid #f39c12; border-radius: 5px; padding: 10px; margin: 10px 0; font-family: monospace;';
        
        // Initialize treasure if it doesn't exist
        if (!encounter.treasure) {
            encounter.treasure = 'No treasure generated yet. Click regenerate to generate treasure.';
        }
        
        treasureDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <strong style="color: #d68910;">💰 Treasure & Loot:</strong>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-small" onclick="generateLoot(${encounterIndex})" style="background: #3498db;" title="Regenerate treasure">↻</button>
                    <button class="btn-small" id="treasure-edit-btn-${encounterIndex}" onclick="toggleTreasureEdit(${encounterIndex})" style="background: #f39c12;" title="Edit treasure">✎</button>
                </div>
            </div>
            <div id="treasure-content-${encounterIndex}" style="white-space: pre-wrap; color: #333;">${encounter.treasure}</div>
        `;
        card.appendChild(treasureDiv);
    }
    
    return card;
}

// Add encounter
function addEncounter() {
    // Auto-populate with players
    const combatants = currentAdventure.players.map(player => ({
        name: player.name,
        initiative: 0,
        hp: player.maxHp || 0,
        maxHp: player.maxHp || 0,
        ac: player.ac || 10,
        notes: '',
        isPlayer: true,
        dndBeyondUrl: player.dndBeyondUrl || ''
    }));
    
    const newEncounterIndex = currentAdventure.encounters.length;
    
    currentAdventure.encounters.push({
        name: 'New Encounter',
        chapter: currentChapter,
        combatants: combatants,
        currentTurn: 0,
        minimized: false  // Expanded by default for new encounters
    });
    renderEncounters();
    autoSave();
    
    // Focus the title input of the newly added encounter
    setTimeout(() => {
        const encounterCards = document.querySelectorAll('.encounter-title');
        // Find the encounter card for this chapter
        const chapterEncounters = currentAdventure.encounters
            .map((encounter, index) => ({ encounter, index }))
            .filter(({ encounter }) => encounter.chapter === currentChapter);
        
        // The new encounter is the last one in the filtered list
        const newEncounterPosition = chapterEncounters.findIndex(({ index }) => index === newEncounterIndex);
        if (newEncounterPosition >= 0 && encounterCards[newEncounterPosition]) {
            encounterCards[newEncounterPosition].focus();
            encounterCards[newEncounterPosition].select();
        }
    }, 50);
}

// Toggle encounter minimize state
function toggleEncounterMinimize(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.minimized = !encounter.minimized;
    renderEncounters();
    autoSave();
}

// Update encounter name
function updateEncounterName(encounterIndex, name) {
    currentAdventure.encounters[encounterIndex].name = name;
    autoSave();
}

// Remove encounter
function removeEncounter(encounterIndex) {
    if (confirm('Delete this encounter?')) {
        currentAdventure.encounters.splice(encounterIndex, 1);
        renderEncounters();
        autoSave();
    }
}

// Add monster from library
let currentEncounterIndex = null;

async function addMonsterFromLibrary(encounterIndex) {
    // Ensure monsters are loaded
    if (!monstersLoaded) {
        await loadMonsters();
    }
    
    currentEncounterIndex = encounterIndex;
    openMonsterModal();
}

// Open monster selection modal
function openMonsterModal() {
    const modal = document.getElementById('monsterModal');
    modal.style.display = 'flex';
    
    const searchInput = document.getElementById('monsterSearch');
    searchInput.value = '';
    searchInput.focus();
    
    // Initial render
    renderMonsterList('');
}

// Close monster modal
function closeMonsterModal() {
    const modal = document.getElementById('monsterModal');
    modal.style.display = 'none';
    currentEncounterIndex = null;
}

// Render monster list based on search
function renderMonsterList(searchTerm) {
    const monsterList = document.getElementById('monsterList');
    const monsterCount = document.getElementById('monsterCount');
    
    // Get all monsters sorted by CR
    const allMonsters = Object.keys(DND_MONSTERS).sort((a, b) => {
        const crA = parseCR(DND_MONSTERS[a].cr);
        const crB = parseCR(DND_MONSTERS[b].cr);
        return crA - crB;
    });
    
    // Filter by search term
    const searchLower = searchTerm.toLowerCase();
    const filtered = searchTerm ? 
        allMonsters.filter(name => name.toLowerCase().includes(searchLower)) :
        allMonsters;
    
    monsterCount.textContent = `Showing ${filtered.length} of ${allMonsters.length} monsters`;
    
    if (filtered.length === 0) {
        monsterList.innerHTML = '<div class="no-results">No monsters found. Try a different search term.</div>';
        return;
    }
    
    // Render monster items (limit to 50 for performance)
    const displayList = filtered.slice(0, 50);
    monsterList.innerHTML = displayList.map(name => {
        const monster = DND_MONSTERS[name];
        return `
            <div class="monster-item" onclick="selectMonster('${name.replace(/'/g, "\\'")}')">  
                <div class="monster-item-header">
                    <div class="monster-name">${name}</div>
                    <div class="monster-cr">CR ${monster.cr}</div>
                </div>
                <div class="monster-stats">
                    <div class="monster-stat">
                        <span class="monster-stat-label">Type:</span>
                        <span>${monster.type}</span>
                    </div>
                    <div class="monster-stat">
                        <span class="monster-stat-label">Size:</span>
                        <span>${monster.size}</span>
                    </div>
                    <div class="monster-stat">
                        <span class="monster-stat-label">Alignment:</span>
                        <span>${monster.alignment}</span>
                    </div>
                    <div class="monster-stat">
                        <span class="monster-stat-label">📖</span>
                        <span>D&D Beyond</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (filtered.length > 50) {
        monsterList.innerHTML += `<div class="no-results">...and ${filtered.length - 50} more. Refine your search to see them.</div>`;
    }
}

// Select monster and add to encounter
function selectMonster(monsterName) {
    const monster = DND_MONSTERS[monsterName];
    if (!monster) {
        console.error('Monster not found:', monsterName);
        return;
    }
    
    // Validate we have a valid encounter selected
    if (!currentAdventure || !currentAdventure.encounters || currentEncounterIndex === null || !currentAdventure.encounters[currentEncounterIndex]) {
        console.error('No valid encounter selected');
        alert('Please create an encounter first before adding monsters.');
        closeMonsterModal();
        return;
    }
    
    // Save the encounter index before closing modal
    const encounterIndex = currentEncounterIndex;
    
    // Ensure combatants array exists
    if (!currentAdventure.encounters[encounterIndex].combatants) {
        currentAdventure.encounters[encounterIndex].combatants = [];
    }
    
    closeMonsterModal();
    
    // Ask for quantity
    const quantity = parseInt(prompt(`How many ${monsterName}(s)?`, '1')) || 1;
    
    // Find existing monsters with the same name to determine starting number
    const existingCombatants = currentAdventure.encounters[encounterIndex].combatants;
    let maxNumber = 0;
    
    // Check for existing monsters with this name
    existingCombatants.forEach(combatant => {
        // Check if name matches pattern "MonsterName" or "MonsterName N"
        if (combatant.name === monsterName) {
            maxNumber = Math.max(maxNumber, 1);
        } else if (combatant.name.startsWith(monsterName + ' ')) {
            const numMatch = combatant.name.match(new RegExp(`^${monsterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`));
            if (numMatch) {
                maxNumber = Math.max(maxNumber, parseInt(numMatch[1]));
            }
        }
    });
    
    // If there's an unnumbered monster and we're adding more, rename it to "MonsterName 1"
    if (maxNumber === 1) {
        const unnumbered = existingCombatants.find(c => c.name === monsterName);
        if (unnumbered) {
            unnumbered.name = `${monsterName} 1`;
        }
    }
    
    // Add monster(s) to the encounter
    for (let i = 0; i < quantity; i++) {
        const number = maxNumber + i + 1;
        const name = (quantity > 1 || maxNumber > 0) ? `${monsterName} ${number}` : monsterName;
        currentAdventure.encounters[encounterIndex].combatants.push({
            name: name,
            initiative: 0,
            hp: 0,  // Will be fetched from D&D Beyond
            maxHp: 0,  // Will be fetched from D&D Beyond
            ac: 10,  // Will be fetched from D&D Beyond
            cr: monster.cr,
            dndBeyondUrl: monster.url,
            notes: '',
            isPlayer: false
        });
    }
    
    console.log(`Added ${quantity}x ${monsterName} to encounter`);
    renderEncounters();
    autoSave();
    
    // Fetch detailed stats from D&D Beyond (JIT)
    fetchMonsterDetails(monster.url, encounterIndex, monsterName);
}

// Fetch monster details from D&D Beyond (JIT)
async function fetchMonsterDetails(monsterUrl, encounterIndex, monsterName) {
    if (!monsterUrl) {
        console.log('No URL provided for monster details');
        return;
    }
    
    try {
        console.log(`Fetching details for ${monsterName} from D&D Beyond...`);
        showToast(`Fetching ${monsterName} details from D&D Beyond...`, 'info', 2000);
        
        // URL encode just the URL part for the API
        const encodedUrl = encodeURIComponent(monsterUrl);
        const response = await fetch(`/api/dndbeyond/monster/${encodedUrl}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            console.error(`Failed to fetch monster details: ${data.error}`);
            showToast(`Failed to fetch ${monsterName} details: ${data.error}`, 'error', 5000);
            return;
        }
        
        const details = data.details;
        console.log(`Fetched details for ${monsterName}:`, details);
        
        // Check if we got any useful data
        if (!details.ac && !details.hp) {
            console.warn(`No AC or HP found for ${monsterName}`);
            showToast(`No stats found for ${monsterName} - please enter manually`, 'warning', 5000);
            return;
        }
        
        // Update all combatants with this monster name that have default values
        const encounter = currentAdventure.encounters[encounterIndex];
        if (!encounter || !encounter.combatants) return;
        
        let updated = 0;
        encounter.combatants.forEach(combatant => {
            // Check if this is a monster we just added (name matches or is numbered version)
            const isMatch = combatant.name === monsterName || 
                           combatant.name.startsWith(monsterName + ' ');
            
            if (isMatch && combatant.dndBeyondUrl === monsterUrl) {
                // Only update if values are still at defaults
                if (details.ac && combatant.ac === 10) {
                    combatant.ac = details.ac;
                }
                if (details.hp && combatant.maxHp === 0) {
                    combatant.maxHp = details.hp;
                    combatant.hp = details.hp;  // Set current HP to max
                }
                updated++;
            }
        });
        
        if (updated > 0) {
            console.log(`Updated ${updated} combatant(s) with fetched details`);
            const statsMsg = [];
            if (details.ac) statsMsg.push(`AC ${details.ac}`);
            if (details.hp) statsMsg.push(`HP ${details.hp}`);
            if (details.initiativeModifier !== undefined) {
                statsMsg.push(`Init ${details.initiativeModifier >= 0 ? '+' : ''}${details.initiativeModifier}`);
            }
            showToast(`✓ ${monsterName}: ${statsMsg.join(', ')}`, 'success');
            renderEncounters();
            autoSave();
        } else {
            showToast(`No combatants updated for ${monsterName}`, 'warning');
        }
        
        // Roll initiative for newly added monsters if we have the modifier
        if (details.initiativeModifier !== undefined) {
            encounter.combatants.forEach(combatant => {
                const isMatch = combatant.name === monsterName || 
                               combatant.name.startsWith(monsterName + ' ');
                
                if (isMatch && combatant.dndBeyondUrl === monsterUrl && combatant.initiative === 0) {
                    // Roll d20 + modifier
                    const d20 = Math.floor(Math.random() * 20) + 1;
                    combatant.initiative = d20 + details.initiativeModifier;
                    console.log(`Rolled initiative for ${combatant.name}: ${d20} + ${details.initiativeModifier} = ${combatant.initiative}`);
                }
            });
            renderEncounters();
            autoSave();
        }
        
    } catch (error) {
        console.error('Error fetching monster details:', error);
        showToast(`Error fetching ${monsterName} details: ${error.message}`, 'error', 5000);
    }
}

// Helper to parse CR for sorting
function parseCR(cr) {
    if (cr.includes('/')) {
        const parts = cr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr);
}

// Add custom combatant (old function renamed)
function addCustomCombatant(encounterIndex) {
    currentAdventure.encounters[encounterIndex].combatants.push({
        name: '',
        initiative: 0,
        hp: 0,
        maxHp: 0,
        ac: 10,
        cr: '',
        dndBeyondUrl: '',
        notes: '',
        isPlayer: false
    });
    renderEncounters();
    autoSave();
}

// Update combatant
function updateCombatant(encounterIndex, combatantIndex, field, value) {
    currentAdventure.encounters[encounterIndex].combatants[combatantIndex][field] = value;
    renderEncounters();
    autoSave();
}

// Remove combatant
function removeCombatant(encounterIndex, combatantIndex) {
    if (confirm('Remove this combatant?')) {
        currentAdventure.encounters[encounterIndex].combatants.splice(combatantIndex, 1);
        renderEncounters();
        autoSave();
    }
}

// Sort by initiative
function sortInitiative(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.combatants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    renderEncounters();
    autoSave();
}

// Refresh players in encounter from top players list
function refreshPlayers(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Remove all player combatants from the encounter
    encounter.combatants = encounter.combatants.filter(c => !isPlayerCombatant(c));
    
    // Add all players from the Players section
    currentAdventure.players.forEach(player => {
        encounter.combatants.push({
            name: player.name,
            initiative: 0,
            hp: player.maxHp || 0,
            maxHp: player.maxHp || 0,
            ac: player.ac || 10,
            notes: '',
            isPlayer: true,
            dndBeyondUrl: player.dndBeyondUrl || ''
        });
    });
    
    // Reset encounter to never started state
    encounter.state = null;
    encounter.currentTurn = 0;
    encounter.currentRound = 0;
    encounter.activeCombatant = null;
    
    renderEncounters();
    autoSave();
}

// Reset encounter to unstarted state
function resetEncounter(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Reset to unstarted state
    encounter.state = null;
    encounter.currentTurn = 0;
    encounter.currentRound = 0;
    encounter.activeCombatant = null;
    
    renderEncounters();
    autoSave();
}

// Generate treasure/loot based on encounter enemies
function generateLoot(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Get all non-player combatants
    const enemies = encounter.combatants.filter(c => !isPlayerCombatant(c));
    
    if (enemies.length === 0) {
        alert('No enemies in this encounter to generate loot from!');
        return;
    }
    
    // Calculate total CR value
    let totalCR = 0;
    enemies.forEach(enemy => {
        const cr = enemy.cr || '0';
        if (cr === '1/8') totalCR += 0.125;
        else if (cr === '1/4') totalCR += 0.25;
        else if (cr === '1/2') totalCR += 0.5;
        else totalCR += parseFloat(cr) || 0;
    });
    
    let loot = [];
    
    // Individual treasure (coins)
    if (totalCR < 1) {
        const copper = Math.floor(Math.random() * 20) + 1;
        const silver = Math.floor(Math.random() * 10);
        loot.push(`Coins: ${copper} CP${silver > 0 ? ', ' + silver + ' SP' : ''}`);
    } else if (totalCR < 5) {
        const silver = Math.floor(Math.random() * 30) + 10;
        const gold = Math.floor(Math.random() * 10);
        loot.push(`Coins: ${silver} SP${gold > 0 ? ', ' + gold + ' GP' : ''}`);
    } else if (totalCR < 11) {
        const gold = Math.floor(Math.random() * 50) + 20;
        const platinum = Math.floor(Math.random() * 5);
        loot.push(`Coins: ${gold} GP${platinum > 0 ? ', ' + platinum + ' PP' : ''}`);
    } else if (totalCR < 17) {
        const gold = Math.floor(Math.random() * 100) + 50;
        const platinum = Math.floor(Math.random() * 20) + 5;
        loot.push(`Coins: ${gold} GP, ${platinum} PP`);
    } else {
        const gold = Math.floor(Math.random() * 200) + 100;
        const platinum = Math.floor(Math.random() * 50) + 20;
        loot.push(`Coins: ${gold} GP, ${platinum} PP`);
    }
    
    // Add gems/art objects for higher CR
    if (totalCR >= 3) {
        const numGems = Math.floor(Math.random() * 3) + 1;
        const gemValues = [10, 50, 100, 500, 1000];
        const gemValue = gemValues[Math.min(Math.floor(totalCR / 4), 4)];
        const gemTypes = ['agate', 'quartz', 'onyx', 'jade', 'pearl', 'topaz', 'ruby', 'sapphire', 'emerald', 'diamond'];
        const gemType = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        loot.push(`Gems: ${numGems}× ${gemValue} GP ${gemType}`);
    }
    
    // Add art objects for high CR
    if (totalCR >= 5) {
        const artItems = [
            'silver ewer',
            'carved bone statuette',
            'gold bracelet',
            'embroidered silk handkerchief',
            'small gold idol',
            'gold dragon comb with red garnet eye',
            'painted wooden mask',
            'silver chalice with moonstones'
        ];
        const artValue = totalCR >= 10 ? 750 : totalCR >= 7 ? 250 : 100;
        const artItem = artItems[Math.floor(Math.random() * artItems.length)];
        loot.push(`Art: ${artValue} GP ${artItem}`);
    }
    
    // Magic items for very high CR
    if (totalCR >= 8) {
        const magicItems = [
            'Potion of Healing',
            'Potion of Greater Healing',
            'Spell Scroll (random spell)',
            '+1 Weapon',
            'Bag of Holding',
            'Cloak of Protection',
            'Ring of Protection',
            'Wand of Magic Missiles',
            'Boots of Elvenkind',
            'Gauntlets of Ogre Power'
        ];
        const numItems = totalCR >= 15 ? 2 : 1;
        for (let i = 0; i < numItems; i++) {
            const item = magicItems[Math.floor(Math.random() * magicItems.length)];
            loot.push(`Magic Item: ${item}`);
        }
    }
    
    // Mundane equipment
    const mundaneItems = [
        'rope (50 ft)',
        'torches (5)',
        'rations (1 week)',
        'waterskin',
        'bedroll',
        'tinderbox',
        'backpack',
        'common clothes',
        'belt pouch',
        'hempen rope'
    ];
    if (Math.random() > 0.5) {
        const item = mundaneItems[Math.floor(Math.random() * mundaneItems.length)];
        loot.push(`Equipment: ${item}`);
    }
    
    // Set the treasure
    encounter.treasure = loot.join('\n');
    
    renderEncounters();
    autoSave();
}

// Clear treasure from encounter
function clearLoot(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.treasure = '';
    renderEncounters();
    autoSave();
}

// Toggle treasure editing mode
function toggleTreasureEdit(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    const contentDiv = document.getElementById(`treasure-content-${encounterIndex}`);
    const editBtn = document.getElementById(`treasure-edit-btn-${encounterIndex}`);
    
    if (!contentDiv || !editBtn) return;
    
    // Check if currently in edit mode
    const isEditing = editBtn.getAttribute('data-editing') === 'true';
    
    if (isEditing) {
        // Save mode - get textarea value and save
        const textarea = contentDiv.querySelector('textarea');
        if (textarea) {
            encounter.treasure = textarea.value;
            contentDiv.innerHTML = `<div style="white-space: pre-wrap; color: #333;">${encounter.treasure}</div>`;
            editBtn.textContent = '✎';
            editBtn.title = 'Edit treasure';
            editBtn.style.background = '#f39c12';
            editBtn.setAttribute('data-editing', 'false');
            autoSave();
        }
    } else {
        // Edit mode - show textarea
        const currentTreasure = encounter.treasure || '';
        contentDiv.innerHTML = `
            <textarea style="width: 100%; min-height: 100px; font-family: monospace; padding: 5px; border: 1px solid #ddd; border-radius: 3px;" 
                      id="treasure-textarea-${encounterIndex}">${currentTreasure}</textarea>
        `;
        editBtn.textContent = '✔';
        editBtn.title = 'Save treasure';
        editBtn.style.background = '#2ecc71';
        editBtn.setAttribute('data-editing', 'true');
        
        // Focus the textarea
        setTimeout(() => {
            const textarea = document.getElementById(`treasure-textarea-${encounterIndex}`);
            if (textarea) textarea.focus();
        }, 0);
    }
}

// Start encounter - sort by initiative and mark as started
function startEncounter(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.combatants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    encounter.state = 'started';
    encounter.currentTurn = 0;
    encounter.currentRound = 1;
    
    // Set first combatant as active
    if (encounter.combatants.length > 0) {
        encounter.activeCombatant = encounter.combatants[0].name;
    }
    
    renderEncounters();
    autoSave();
}

// End encounter - mark as not started
function endEncounter(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.state = 'complete';
    encounter.currentTurn = 0;
    // Keep currentRound to show final count
    
    // Clear active state
    encounter.activeCombatant = null;
    
    renderEncounters();
    autoSave();
}

// Next turn
function nextTurn(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    const combatants = encounter.combatants;
    
    // Only advance turn if encounter is started
    if (encounter.state !== 'started' || combatants.length === 0) return;
    
    // Find next
    let currentIndex = encounter.currentTurn || 0;
    currentIndex = (currentIndex + 1) % combatants.length;
    
    // Increment round when we wrap back to the first combatant
    if (currentIndex === 0) {
        encounter.currentRound = (encounter.currentRound || 1) + 1;
    }
    
    encounter.activeCombatant = combatants[currentIndex].name;
    encounter.currentTurn = currentIndex;
    
    renderEncounters();
    autoSave();
}

// Auto-save
function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        const name = document.getElementById('adventureSelect').value;
        if (!name) return;
        
        await fetch(`/api/adventure/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentAdventure)
        });
        
        showSaveIndicator();
    }, 500);
}

// Show save indicator
function showSaveIndicator() {
    let indicator = document.querySelector('.auto-save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'auto-save-indicator';
        indicator.textContent = '✓ Saved';
        document.body.appendChild(indicator);
    }
    
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
}
// Monster Tooltip System
let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipMonster = null;

function createTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'monster-tooltip';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
}

function formatModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Format action description text with proper spacing and bold keywords
function formatActionDescription(text) {
    if (!text) return '';
    
    // Add space after periods before capital letters (e.g., "ft.Hit:" -> "ft. Hit:")
    text = text.replace(/\.([A-Z])/g, '. $1');
    
    // Add space after colons before numbers/text (e.g., "Roll:+3" -> "Roll: +3")
    text = text.replace(/:([+\-0-9])/g, ': $1');
    
    // Add space before "to hit" (e.g., "+4to hit" -> "+4 to hit")
    text = text.replace(/(\d+)(to\s+hit)/gi, '$1 $2');
    
    // Add spaces around parenthesized dice rolls (e.g., "4(1d4 + 2)piercing" -> "4 (1d4 + 2) piercing")
    text = text.replace(/(\d+)\((\d+d\d+(?:\s*[+\-]\s*\d+)?)\)([A-Za-z])/g, '$1 ($2) $3');
    
    // Bold attack roll patterns (e.g., "Melee Attack Roll", "Ranged Attack Roll", "Melee Weapon Attack")
    text = text.replace(/(Melee|Ranged)\s+(Weapon\s+)?(Attack|Spell\s+Attack)(\s+Roll)?/gi, '<strong>$&</strong>');
    
    // Bold damage types
    const damageTypes = [
        'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 
        'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'
    ];
    damageTypes.forEach(type => {
        const regex = new RegExp(`\\b(${type})\\b`, 'gi');
        text = text.replace(regex, '<strong>$1</strong>');
    });
    
    // Bold dice rolls (e.g., "1d4 + 1", "2d6", "1d8 + 3")
    text = text.replace(/\b(\d+d\d+(?:\s*[+\-]\s*\d+)?)\b/gi, '<strong>$1</strong>');
    
    // Bold "Hit:" and "Miss:"
    text = text.replace(/\b(Hit|Miss):/gi, '<strong>$1:</strong>');
    
    return text;
}

// Render tooltip content from entity details
function renderTooltipContent(tooltip, entityName, details, isCharacter = false) {
    if (!details) {
        tooltip.innerHTML = '<div class="monster-tooltip-loading">No details available</div>';
        return;
    }
    
    let html = '';
    
    // Header
    html += '<div class="monster-tooltip-header">';
    html += `<div class="monster-tooltip-title">${entityName}</div>`;
    
    // Meta information
    let meta = [];
    if (isCharacter) {
        // For characters, show summary (e.g., "Level 1 Tiefling Rogue")
        if (details.summary) {
            meta.push(details.summary);
        } else {
            // Build from classes array or flat fields
            if (details.classes && details.classes.length > 0) {
                const classStr = details.classes.map(c => `${c.name} ${c.level}`).join('/');
                meta.push(classStr);
            } else if (details.level && details.class) {
                meta.push(`Level ${details.level} ${details.class}`);
            } else if (details.class) {
                meta.push(details.class);
            }
            if (details.race) meta.push(details.race);
        }
        // Add player name if available and different from character name
        if (details.playerName && details.playerName !== entityName) {
            meta.push(`(${details.playerName})`);
        }
    } else {
        // For monsters, show size/type/alignment
        if (details.size) meta.push(details.size);
        if (details.type) meta.push(details.type);
        if (details.alignment) meta.push(details.alignment);
    }
    if (meta.length > 0) {
        html += `<div class="monster-tooltip-meta">${meta.join(', ')}</div>`;
    }
    html += '</div>';
    
    // Basic Stats
    html += '<div class="monster-tooltip-stats">';
    if (details.ac) {
        const acDisplay = details.acType ? `${details.ac} (${details.acType})` : details.ac;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">AC:</span><span class="monster-tooltip-stat-value">${acDisplay}</span></div>`;
    }
    // Handle HP - check for object first (character format), then numeric/string (monster format)
    if (details.hp && typeof details.hp === 'object') {
        // Character format: {current: X, max: Y}
        const hpDisplay = details.hp.max ? `${details.hp.current || details.hp.max}/${details.hp.max}` : details.hp.current || details.hp.max;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">HP:</span><span class="monster-tooltip-stat-value">${hpDisplay}</span></div>`;
    } else if (details.hp) {
        // Monster format: numeric HP value
        const hpDisplay = details.hitDice ? `${details.hp} (${details.hitDice})` : details.hp;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">HP:</span><span class="monster-tooltip-stat-value">${hpDisplay}</span></div>`;
    } else if (details.maxHp) {
        // Alternative format: maxHp field
        const hpDisplay = details.hitDice ? `${details.maxHp} (${details.hitDice})` : details.maxHp;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">HP:</span><span class="monster-tooltip-stat-value">${hpDisplay}</span></div>`;
    }
    if (details.speed) {
        const speedDisplay = typeof details.speed === 'number' ? `${details.speed} ft.` : details.speed;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Speed:</span><span class="monster-tooltip-stat-value">${speedDisplay}</span></div>`;
    } else if (details.walkSpeed) {
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Speed:</span><span class="monster-tooltip-stat-value">${details.walkSpeed} ft.</span></div>`;
    }
    // Handle both initiativeBonus (monsters) and initiative (characters)
    const init = details.initiativeBonus !== undefined ? details.initiativeBonus : 
                 details.initiativeModifier !== undefined ? details.initiativeModifier : details.initiative;
    if (init !== undefined) {
        const initDisplay = init >= 0 ? `+${init}` : `${init}`;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Initiative:</span><span class="monster-tooltip-stat-value">${initDisplay}</span></div>`;
    }
    if (!isCharacter && details.cr) {
        const xp = details.xp || CR_TO_XP[details.cr] || '';
        const crDisplay = xp ? `${details.cr} (${xp} XP)` : details.cr;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">CR:</span><span class="monster-tooltip-stat-value">${crDisplay}</span></div>`;
    }
    html += '</div>';
    
    // Ability Scores - handle both old format (nested object) and new format (flat values with separate modifiers)
    const abilities = details.abilities || details.abilityScores;
    const abilityMods = details.ability_modifiers;
    if (abilities) {
        html += '<div class="monster-tooltip-abilities">';
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
            let score, mod;
            if (typeof abilities[ability] === 'object' && abilities[ability] !== null) {
                // Old format: {score: 10, modifier: 0}
                score = abilities[ability].score || 10;
                mod = abilities[ability].modifier !== undefined ? abilities[ability].modifier : formatModifier(score);
            } else if (typeof abilities[ability] === 'number') {
                // New format: abilities[ability] = 10, ability_modifiers[ability] = 0
                score = abilities[ability];
                mod = abilityMods && abilityMods[ability] !== undefined ? abilityMods[ability] : Math.floor((score - 10) / 2);
            } else {
                return; // Skip if no data
            }
            
            const modDisplay = mod >= 0 ? `+${mod}` : `${mod}`;
            html += `<div class="monster-tooltip-ability">
                <div class="monster-tooltip-ability-name">${ability.toUpperCase()}</div>
                <div class="monster-tooltip-ability-score">${score}</div>
                <div class="monster-tooltip-ability-mod">${modDisplay}</div>
            </div>`;
        });
        html += '</div>';
    }
    
    // Saving Throws
    if (details.savingThrows) {
        let saves = '';
        if (typeof details.savingThrows === 'string') {
            saves = details.savingThrows;
        } else if (typeof details.savingThrows === 'object' && Object.keys(details.savingThrows).length > 0) {
            saves = Object.entries(details.savingThrows)
                .map(([ability, bonus]) => `${ability.toUpperCase()} ${bonus >= 0 ? '+' : ''}${bonus}`)
                .join(', ');
        }
        if (saves) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Saving Throws</div>';
            html += `<div class="monster-tooltip-section-content">${saves}</div>`;
            html += '</div>';
        }
    }
    
    // Skills
    if (details.skills) {
        let skillsText = '';
        if (typeof details.skills === 'string') {
            // Parse "Deception+3,Stealth+5" format and add spaces
            skillsText = details.skills.replace(/([a-zA-Z]+)(\+|-)/g, '$1 $2');
        } else if (typeof details.skills === 'object' && Object.keys(details.skills).length > 0) {
            skillsText = Object.entries(details.skills)
                .map(([skill, bonus]) => `${skill} ${bonus >= 0 ? '+' : ''}${bonus}`)
                .join(', ');
        }
        if (skillsText) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Skills</div>';
            html += `<div class="monster-tooltip-section-content">${skillsText}</div>`;
            html += '</div>';
        }
    }
    
    // For characters, show passive senses
    if (isCharacter) {
        let passives = [];
        
        // Calculate passives from ability scores and skill proficiencies if available
        if (details.abilityScores) {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const level = details.level || 1;
            const profBonus = 2 + Math.floor((level - 1) / 4);
            
            const wisScore = details.abilityScores.wis || 10;
            const intScore = details.abilityScores.int || 10;
            const wisMod = calcMod(wisScore);
            const intMod = calcMod(intScore);
            
            const skillProfs = details.skillProficiencies || {};
            
            const passivePerception = 10 + wisMod + (skillProfs.perception ? profBonus : 0);
            const passiveInvestigation = 10 + intMod + (skillProfs.investigation ? profBonus : 0);
            const passiveInsight = 10 + wisMod + (skillProfs.insight ? profBonus : 0);
            
            passives.push(`Perception ${passivePerception}`);
            passives.push(`Investigation ${passiveInvestigation}`);
            passives.push(`Insight ${passiveInsight}`);
        } else {
            // Fallback to pre-calculated values if available
            if (details.passivePerception) passives.push(`Perception ${details.passivePerception}`);
            if (details.passiveInvestigation) passives.push(`Investigation ${details.passiveInvestigation}`);
            if (details.passiveInsight) passives.push(`Insight ${details.passiveInsight}`);
        }
        
        if (passives.length > 0) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Passive Senses</div>';
            html += `<div class="monster-tooltip-section-content">${passives.join(', ')}</div>`;
            html += '</div>';
        }
    }
    
    // Resistances/Immunities (for monsters)
    if (!isCharacter) {
        if (details.damageResistances) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Resistances</div>';
            html += `<div class="monster-tooltip-section-content">${details.damageResistances}</div>`;
            html += '</div>';
        }
        if (details.damageImmunities) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Immunities</div>';
            html += `<div class="monster-tooltip-section-content">${details.damageImmunities}</div>`;
            html += '</div>';
        }
        if (details.conditionImmunities) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Condition Immunities</div>';
            html += `<div class="monster-tooltip-section-content">${details.conditionImmunities}</div>`;
            html += '</div>';
        }
    }
    
    // Senses
    if (details.senses) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Senses</div>';
        html += `<div class="monster-tooltip-section-content">${details.senses}</div>`;
        html += '</div>';
    }
    
    // Languages
    if (details.languages) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Languages</div>';
        html += `<div class="monster-tooltip-section-content">${details.languages}</div>`;
        html += '</div>';
    }
    
    // Proficiencies (for characters)
    if (isCharacter && details.proficiencies) {
        for (const [label, items] of Object.entries(details.proficiencies)) {
            if (items) {
                html += '<div class="monster-tooltip-section">';
                html += `<div class="monster-tooltip-section-title">${label}</div>`;
                html += `<div class="monster-tooltip-section-content">${items}</div>`;
                html += '</div>';
            }
        }
    }
    
    // Features/Traits
    const featuresLabel = isCharacter ? 'Features & Traits' : 'Traits';
    const featuresArray = details.features || details.traits;
    
    if (featuresArray && featuresArray.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += `<div class="monster-tooltip-section-title">${featuresLabel}</div>`;
        featuresArray.forEach(feature => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${feature.name}</div>`;
            if (feature.description) {
                html += `<div class="monster-tooltip-action-desc">${formatActionDescription(feature.description)}</div>`;
            }
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Actions (for monsters)
    if (!isCharacter && details.actions && details.actions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Actions</div>';
        details.actions.forEach(action => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatActionDescription(action.description)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Legendary Actions (for monsters)
    if (!isCharacter && details.legendaryActions && details.legendaryActions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Legendary Actions</div>';
        if (details.legendaryActionsDescription) {
            html += `<div class="monster-tooltip-section-content" style="margin-bottom: 8px;">${formatActionDescription(details.legendaryActionsDescription)}</div>`;
        }
        details.legendaryActions.forEach(action => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatActionDescription(action.description)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Reactions (for monsters)
    if (!isCharacter && details.reactions && details.reactions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Reactions</div>';
        details.reactions.forEach(reaction => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${reaction.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatActionDescription(reaction.description)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    tooltip.innerHTML = html;
}

// Determine if URL is a character or monster based on URL pattern
function isCharacterUrl(url) {
    return url && (url.includes('/profile/') || url.includes('/characters/'));
}

function showMonsterTooltip(entityName, entityUrl, event) {
    console.log('showMonsterTooltip called:', entityName, entityUrl);
    clearTimeout(tooltipTimeout);
    
    const tooltip = createTooltipElement();
    
    // Position tooltip near the cursor (fixed position, doesn't follow mouse)
    const positionTooltip = (e) => {
        const x = e.clientX + 15;
        const y = e.clientY + 15;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Set initial position
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
        
        // After rendering, check if it goes off screen and adjust
        requestAnimationFrame(() => {
            const rect = tooltip.getBoundingClientRect();
            
            let finalX = x;
            let finalY = y;
            
            // Adjust horizontal position if off screen
            if (rect.right > viewportWidth - 20) {
                finalX = viewportWidth - rect.width - 20;
            }
            
            // Adjust vertical position if off screen
            if (rect.bottom > viewportHeight - 20) {
                finalY = viewportHeight - rect.height - 20;
            }
            
            // Ensure it's not off the left or top
            finalX = Math.max(10, finalX);
            finalY = Math.max(10, finalY);
            
            tooltip.style.left = finalX + 'px';
            tooltip.style.top = finalY + 'px';
        });
    };
    
    // Store current entity being displayed
    currentTooltipMonster = entityName;
    
    // Add mouse enter/leave handlers to keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        clearTimeout(tooltipTimeout);
    });
    
    tooltip.addEventListener('mouseleave', () => {
        hideMonsterTooltip();
    });
    
    // Check if this is a local player (using player: prefix)
    const isLocalPlayer = entityUrl.startsWith('player:');
    
    // Determine if this is a character or monster
    const isCharacter = isLocalPlayer || isCharacterUrl(entityUrl);
    const entityType = isCharacter ? 'character' : 'monster';
    console.log('Entity type:', entityType, 'URL:', entityUrl, 'isLocalPlayer:', isLocalPlayer);
    
    // First, try to find the entity in our current encounters or players (it's already loaded)
    let cachedDetails = null;
    
    if (isCharacter && currentAdventure && currentAdventure.players) {
        // Check players list for character details
        for (const player of currentAdventure.players) {
            if (player.name === entityName || (player.dndBeyondUrl === entityUrl) || isLocalPlayer) {
                cachedDetails = player;
                break;
            }
        }
    }
    
    if (!cachedDetails && currentAdventure && currentAdventure.encounters) {
        // Check encounters for cached data
        for (const encounter of currentAdventure.encounters) {
            if (encounter.combatants) {
                for (const combatant of encounter.combatants) {
                    if (combatant.name === entityName && combatant.dndBeyondUrl === entityUrl) {
                        cachedDetails = combatant;
                        break;
                    }
                }
            }
            if (cachedDetails) break;
        }
    }
    
    // If we have cached details with FULL info (abilities present), use them immediately
    // For characters, also use local player data even without abilities
    // For local players (player: prefix), always use local data
    if (cachedDetails && (cachedDetails.abilities || (isCharacter && cachedDetails.ac) || isLocalPlayer)) {
        console.log('Using cached details:', cachedDetails);
        tooltip.style.display = 'block';
        positionTooltip(event);
        renderTooltipContent(tooltip, entityName, cachedDetails, isCharacter);
        return;
    }
    
    // If this is a local player but no data found, show error
    if (isLocalPlayer) {
        tooltip.innerHTML = `<div class="monster-tooltip-loading">
            <div style="margin-bottom: 8px;">⚠️ Player data not found</div>
            <div style="font-size: 12px; color: #666;">
                Add this character to the Players section above.
            </div>
        </div>`;
        tooltip.style.display = 'block';
        positionTooltip(event);
        return;
    }
    
    console.log('No full cached details, fetching from server...');
    
    // Otherwise, show loading and fetch from server
    const loadingText = isCharacter ? 'Loading character details...' : 'Loading monster details...';
    tooltip.innerHTML = `<div class="monster-tooltip-loading">${loadingText}</div>`;
    tooltip.style.display = 'block';
    positionTooltip(event);
    
    // Fetch details from appropriate endpoint
    const apiEndpoint = isCharacter ? 
        `/api/dndbeyond/character/${encodeURIComponent(entityUrl)}` :
        `/api/dndbeyond/monster/${encodeURIComponent(entityUrl)}`;
    
    console.log('Fetching from:', apiEndpoint);
    
    fetch(apiEndpoint)
        .then(response => {
            console.log('Response received:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data);
            console.log('Data structure - success:', data.success, 'details:', data.details ? 'exists' : 'missing', 'error:', data.error);
            // Only update if this is still the current tooltip
            if (currentTooltipMonster !== entityName) return;
            
            // Check if there was an error
            if (!data.success || data.error) {
                if (isCharacter) {
                    // For characters, fall back to local player data if available
                    console.log('Character API failed, checking for local player data...');
                    if (currentAdventure && currentAdventure.players) {
                        for (const player of currentAdventure.players) {
                            if (player.name === entityName || (player.dndBeyondUrl && player.dndBeyondUrl === entityUrl)) {
                                console.log('Found local player data:', player);
                                renderTooltipContent(tooltip, entityName, player, true);
                                return;
                            }
                        }
                    }
                    // No local data available
                    tooltip.innerHTML = `<div class="monster-tooltip-loading">
                        <div style="margin-bottom: 8px;">⚠️ Character sheet unavailable</div>
                        <div style="font-size: 12px; color: #666;">
                            To fetch live data from D&D Beyond, you need to:<br>
                            1. Log into D&D Beyond in your browser<br>
                            2. Export cookies and save them using the app<br>
                            <br>
                            Or add character stats in the Players table above.
                        </div>
                    </div>`;
                } else {
                    tooltip.innerHTML = `<div class="monster-tooltip-loading">⚠️ ${data.error || 'Failed to load details'}</div>`;
                }
                return;
            }
            
            // Use the details from the response
            const details = data.details || data.data || data;
            console.log('Extracted details:', details);
            console.log('Details has abilities?', details.abilities ? 'yes' : 'no');
            console.log('Details has hp?', details.hp !== undefined ? 'yes' : 'no');
            renderTooltipContent(tooltip, entityName, details, isCharacter);
            
            // Reposition after content is loaded in case size changed
            positionTooltip(event);
        })
        .catch(error => {
            console.error(`Error fetching ${entityType} details:`, error);
            if (currentTooltipMonster === entityName) {
                tooltip.innerHTML = `<div class="monster-tooltip-loading">Failed to load ${entityType} details</div>`;
            }
        });
}

function hideMonsterTooltip() {
    tooltipTimeout = setTimeout(() => {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
            currentTooltipMonster = null;
        }
    }, 100);
}