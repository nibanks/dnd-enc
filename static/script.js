// Global state
let currentAdventure = null;
let currentChapter = null;
let autoSaveTimeout = null;
let DND_MONSTERS = {}; // Will be populated dynamically or use fallback
let monstersLoaded = false;

// D&D 5e/2024 Classes
const DND_CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
    'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
];

// D&D 5e/2024 Races
const DND_RACES = [
    'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 
    'Human', 'Tiefling', 'Aasimar', 'Firbolg', 'Genasi', 'Goliath', 'Kenku', 
    'Lizardfolk', 'Tabaxi', 'Tortle', 'Triton', 'Aarakocra', 'Bugbear', 
    'Goblin', 'Hobgoblin', 'Kobold', 'Orc', 'Yuan-ti'
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
        const select = document.getElementById('adventureSelect');
        select.value = adventureName;
        // Trigger the change event to load the adventure
        await handleAdventureChange({ target: select });
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
            showCookieStatus(`✓ Cookies saved! You can now add monsters and their details will be fetched automatically.`, 'success');
        } else {
            showCookieStatus('Failed to save cookies: ' + result.error, 'error');
        }
    } catch (error) {
        showCookieStatus('Error: ' + error.message, 'error');
    }
}

function clearCookies() {
    if (confirm('Clear saved D&D Beyond cookies?')) {
        fetch('/api/dndbeyond/clear-cookies', { method: 'POST' });
        document.getElementById('cookieInput').value = '';
        showCookieStatus('Cookies cleared. Will use fallback monster list.', 'info');
        
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
function renderPlayers() {
    const tbody = document.getElementById('playersBody');
    tbody.innerHTML = '';
    
    if (!currentAdventure.players) {
        currentAdventure.players = [];
    }
    
    currentAdventure.players.forEach((player, index) => {
        const classOptions = DND_CLASSES.map(c => `<option value="${c}" ${player.class === c ? 'selected' : ''}>${c}</option>`).join('');
        const raceOptions = DND_RACES.map(r => `<option value="${r}" ${player.race === r ? 'selected' : ''}>${r}</option>`).join('');
        
        row = tbody.insertRow();
        row.innerHTML = `
            <td><button class="btn-small" onclick="editPlayerUrl(${index})" style="padding: 4px 8px; font-size: 16px; background: #3498db;" title="Edit D&D Beyond URL">🔗</button></td>
            <td><input type="text" value="${player.playerName || ''}" onchange="updatePlayer(${index}, 'playerName', this.value)" style="width: 100px;"></td>
            <td><input type="text" value="${player.name || ''}" onchange="updatePlayer(${index}, 'name', this.value)" style="width: 100px;"></td>
            <td><select onchange="updatePlayer(${index}, 'race', this.value)" style="width: 100px;"><option value="">Select Race</option>${raceOptions}</select></td>
            <td><select onchange="updatePlayer(${index}, 'class', this.value)" style="width: 110px;"><option value="">Select Class</option>${classOptions}</select></td>
            <td><input type="number" value="${player.level || 1}" onchange="updatePlayer(${index}, 'level', parseInt(this.value))" style="width: 38px;"></td>
            <td><input type="number" value="${player.maxHp || 0}" onchange="updatePlayer(${index}, 'maxHp', parseInt(this.value))" style="width: 45px;"></td>
            <td><input type="number" value="${player.ac || 10}" onchange="updatePlayer(${index}, 'ac', parseInt(this.value))" style="width: 38px;"></td>
            <td><input type="number" value="${player.speed || 30}" onchange="updatePlayer(${index}, 'speed', parseInt(this.value))" style="width: 38px;"></td>
            <td><input type="number" value="${player.initiativeBonus || 0}" onchange="updatePlayer(${index}, 'initiativeBonus', parseInt(this.value))" style="width: 38px;"></td>
            <td><input type="number" value="${player.passivePerception || 10}" onchange="updatePlayer(${index}, 'passivePerception', parseInt(this.value))" style="width: 38px;"></td>
            <td><input type="number" value="${player.passiveInsight || 10}" onchange="updatePlayer(${index}, 'passiveInsight', parseInt(this.value))" style="width: 38px;"></td>
            <td><input type="number" value="${player.passiveInvestigation || 10}" onchange="updatePlayer(${index}, 'passiveInvestigation', parseInt(this.value))" style="width: 38px;"></td>
            <td style="width: 150px;"><input type="text" value="${player.notes || ''}" onchange="updatePlayer(${index}, 'notes', this.value)" style="width: 150px;"></td>
            <td><button class="btn-small" onclick="removePlayer(${index})" style="background: #e74c3c; padding: 4px 8px;" title="Delete this player">×</button></td>
        `;
    });
}

// Add player
function addPlayer() {
    currentAdventure.players.push({
        name: '',
        playerName: '',
        race: '',
        class: '',
        level: 1,
        maxHp: 0,
        ac: 10,
        speed: 30,
        initiativeBonus: 0,
        passivePerception: 10,
        passiveInsight: 10,
        passiveInvestigation: 10,
        notes: ''
    });
    renderPlayers();
    autoSave();
}

// Update player
function updatePlayer(index, field, value) {
    currentAdventure.players[index][field] = value;
    autoSave();
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
            // Look up CR from monster list
            const baseName = combatant.name.split(' ')[0]; // Get base name
            const monster = DND_MONSTERS[baseName];
            const cr = monster?.cr || combatant.cr || ''; // Fallback to combatant.cr if stored
            const xp = CR_TO_XP[cr] || 0;
            return sum + xp;
        }, 0);
    
    return totalXP.toLocaleString();
}

// Create encounter card
function createEncounterCard(encounter, encounterIndex) {
    const card = document.createElement('div');
    card.className = 'encounter-card';
    
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
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 600px;">
                    <button class="btn-small" onclick="toggleEncounterMinimize(${encounterIndex})" title="${encounter.minimized ? 'Expand' : 'Minimize'}" style="background: #95a5a6; padding: 4px 8px; font-size: 14px;">${minimizeIcon}</button>
                    <input type="text" class="encounter-title" value="${encounter.name || 'New Encounter'}" 
                           onchange="updateEncounterName(${encounterIndex}, this.value)" style="border: 1px solid #ddd; padding: 5px; flex: 1;">
                    <span style="color: #666; font-size: 14px; font-weight: 500; white-space: nowrap;">XP: ${calculateEncounterXP(encounter)}</span>
                </div>
                ${showControls ? `
                <div class="encounter-controls">
                    <button class="btn-small" onclick="addMonsterFromLibrary(${encounterIndex})" style="background: #27ae60;" title="Add a monster to this encounter">+</button>
                    <button class="btn-small" onclick="refreshPlayers(${encounterIndex})" style="background: #3498db;" title="Refresh player stats from Players section">↻</button>
                    <button class="btn-small" onclick="removeEncounter(${encounterIndex})" style="background: #e74c3c;" title="Delete this encounter">×</button>
                </div>
                ` : ''}
            </div>
            <div style="display: ${encounter.minimized ? 'none' : 'flex'}; align-items: center; gap: 15px;">
                <div class="encounter-controls">
                    ${encounterButtons}
                </div>
                ${encounter.state === 'started' || encounter.state === 'complete' ? `<span style="color: #666; font-weight: 500;">Round ${encounter.currentRound || 1}</span>` : ''}
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
                <th style="width: 80px; text-align: center;">Max HP</th>
                <th style="width: 80px; text-align: center;">HP</th>
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
            // Look up monster details from DND_MONSTERS
            const baseName = combatant.name.split(' ')[0]; // Get base name (e.g., "Cultist" from "Cultist 2")
            const monster = DND_MONSTERS[baseName];
            if (monster) {
                ac = monster.ac || 10;
                cr = monster.cr || '';
                dndBeyondUrl = monster.url || '';
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
            // Players: always show as link if they have URL, otherwise just text (not input box)
            if (dndBeyondUrl) {
                const escapedUrl = dndBeyondUrl.replace(/'/g, "\\'");
                nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                    class="monster-name-hover" 
                    onmouseenter="showMonsterTooltip('${combatant.name.replace(/'/g, "\\'")}', '${escapedUrl}', event)"
                    onmouseleave="hideMonsterTooltip()">${combatant.name || ''}</a>`;
            } else {
                nameHTML = `<span style="font-weight: 500; color: ${inheritColor};">${combatant.name || ''}</span>`;
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
            <td style="text-align: center;">${!encounter.state ? `<input type="number" value="${combatant.maxHp || 0}" style="text-align: center;" onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'maxHp', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${combatant.maxHp || 0}</span>`}</td>
            <td><input type="number" class="hp-input" value="${combatant.hp || 0}" style="text-align: center;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'hp', parseInt(this.value))"></td>
            <td><input type="text" value="${combatant.notes || ''}" 
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'notes', this.value)"></td>
            <td><button class="btn-small" onclick="removeCombatant(${encounterIndex}, ${combatantIndex})" style="background: #e74c3c; padding: 4px 8px;" title="Delete this combatant">×</button></td>
        `;
    });
    
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
    
    currentAdventure.encounters.push({
        name: 'New Encounter',
        chapter: currentChapter,
        combatants: combatants,
        currentTurn: 0,
        minimized: true
    });
    renderEncounters();
    autoSave();
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
    
    // Update each player combatant with current stats from players list
    encounter.combatants.forEach(combatant => {
        if (isPlayerCombatant(combatant)) {
            const player = currentAdventure.players.find(p => p.name === combatant.name);
            if (player) {
                combatant.maxHp = player.maxHp || 0;
                combatant.ac = player.ac || 10;
                combatant.dndBeyondUrl = player.dndBeyondUrl || '';
            }
        }
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
            // Build from classes array
            if (details.classes && details.classes.length > 0) {
                const classStr = details.classes.map(c => `${c.name} ${c.level}`).join('/');
                meta.push(classStr);
            } else if (details.class) {
                meta.push(details.class);
            }
            if (details.race) meta.push(details.race);
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
    const abilities = details.abilities;
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
        if (details.passivePerception) passives.push(`Perception ${details.passivePerception}`);
        if (details.passiveInsight) passives.push(`Insight ${details.passiveInsight}`);
        if (details.passiveInvestigation) passives.push(`Investigation ${details.passiveInvestigation}`);
        
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
                html += `<div class="monster-tooltip-action-desc">${feature.description}</div>`;
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
            html += `<div class="monster-tooltip-action-desc">${action.description}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Legendary Actions (for monsters)
    if (!isCharacter && details.legendaryActions && details.legendaryActions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Legendary Actions</div>';
        if (details.legendaryActionsDescription) {
            html += `<div class="monster-tooltip-section-content" style="margin-bottom: 8px;">${details.legendaryActionsDescription}</div>`;
        }
        details.legendaryActions.forEach(action => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${action.description}</div>`;
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
            html += `<div class="monster-tooltip-action-desc">${reaction.description}</div>`;
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
    
    // Determine if this is a character or monster
    const isCharacter = isCharacterUrl(entityUrl);
    const entityType = isCharacter ? 'character' : 'monster';
    console.log('Entity type:', entityType, 'URL:', entityUrl);
    
    // First, try to find the entity in our current encounters or players (it's already loaded)
    let cachedDetails = null;
    
    if (isCharacter && currentAdventure && currentAdventure.players) {
        // Check players list for character details
        for (const player of currentAdventure.players) {
            if (player.name === entityName || (player.dndBeyondUrl === entityUrl)) {
                cachedDetails = player;
                // Build abilities object from player data if not present
                if (!cachedDetails.abilities && cachedDetails.initiativeBonus !== undefined) {
                    // Calculate ability scores from initiative bonus (assuming it comes from DEX)
                    cachedDetails.abilities = {
                        dex: {
                            score: 10 + (cachedDetails.initiativeBonus * 2),
                            modifier: cachedDetails.initiativeBonus
                        }
                    };
                }
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
    if (cachedDetails && (cachedDetails.abilities || (isCharacter && cachedDetails.ac))) {
        console.log('Using cached details:', cachedDetails);
        tooltip.style.display = 'block';
        positionTooltip(event);
        renderTooltipContent(tooltip, entityName, cachedDetails, isCharacter);
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