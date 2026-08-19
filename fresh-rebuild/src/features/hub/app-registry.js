export const novaApps = Object.freeze([
  // Core utilities that remain reachable without expanding bottom navigation.
  { id: 'wallet', name: 'Wallet', category: 'Core', icon: 'wallet', description: 'Assets, portfolio and wallet actions' },
  { id: 'tasks', name: 'Rewards', category: 'Core', icon: 'tasks', description: 'Daily reward, tasks and verified bonuses' },
  { id: 'market', name: 'Market', category: 'Core', icon: 'market', description: 'Top assets and live market data' },

  // Tools Hub is intentionally flattened into direct apps.
  { id: 'notes', name: 'Notes', category: 'Everyday Tools', icon: 'notes', description: 'Fast private notes' },
  { id: 'todo', name: 'To-Do', category: 'Everyday Tools', icon: 'todo', description: 'Simple focused task list' },
  { id: 'calculator', name: 'Calculator', category: 'Everyday Tools', icon: 'calculator', description: 'Safe everyday calculations' },
  { id: 'unit-converter', name: 'Unit Converter', category: 'Everyday Tools', icon: 'convert', description: 'Length, weight, temperature and data' },
  { id: 'expenses', name: 'Expenses', category: 'Everyday Tools', icon: 'expense', description: 'Personal expense tracking' },
  { id: 'pomodoro', name: 'Focus Timer', category: 'Everyday Tools', icon: 'timer', description: 'Pomodoro focus sessions' },
  { id: 'bmi', name: 'BMI', category: 'Everyday Tools', icon: 'health', description: 'Body mass index calculator' },
  { id: 'tip', name: 'Tip Calculator', category: 'Everyday Tools', icon: 'tip', description: 'Split bills and calculate tips' },
  { id: 'world-clock', name: 'World Clock', category: 'Everyday Tools', icon: 'clock', description: 'Time across major cities' },
  { id: 'qr', name: 'QR Tools', category: 'Everyday Tools', icon: 'qr', description: 'Generate and scan QR codes' },

  { id: 'weather', name: 'Weather', category: 'Live & Local', icon: 'weather', description: 'Current conditions and forecast' },
  { id: 'qibla', name: 'Qibla', category: 'Live & Local', icon: 'qibla', description: 'Live compass and direction' },
  { id: 'speed-test', name: 'Speed Test', category: 'Live & Local', icon: 'speed', description: 'Network speed instrument' },
  { id: 'pakistan', name: 'Pakistan Hub', category: 'Live & Local', icon: 'news', description: 'Pakistan-focused information' },
  { id: 'news', name: 'News', category: 'Live & Local', icon: 'news', description: 'Current headlines and feeds' },

  { id: 'ai', name: 'Nova AI', category: 'Discover', icon: 'ai', description: 'AI chat, voice and research tools' },
  { id: 'browser', name: 'Browser', category: 'Discover', icon: 'browser', description: 'In-app web browsing' },
  { id: 'travel', name: 'Travel', category: 'Discover', icon: 'travel', description: 'Travel planning and live sources' },
  { id: 'learning', name: 'Learning', category: 'Discover', icon: 'teacher', description: 'Study and learning utilities' },
  { id: 'teacher', name: 'Teacher Toolkit', category: 'Discover', icon: 'teacher', description: 'Classroom and teacher utilities' },
  { id: 'documents', name: 'Documents', category: 'Discover', icon: 'document', description: 'Document and file workflows' },
  { id: 'entertainment', name: 'Entertainment', category: 'Discover', icon: 'more', description: 'Entertainment utilities' },

  { id: 'islamic', name: 'Islamic Hub', category: 'Faith & Reading', icon: 'prayer', description: 'Prayer and Islamic utilities' },
  { id: 'quran', name: 'Quran', category: 'Faith & Reading', icon: 'document', description: 'Focused Quran reading' },
  { id: 'hadith', name: 'Hadith', category: 'Faith & Reading', icon: 'document', description: 'Hadith reading library' },
  { id: 'urdu-library', name: 'Urdu Library', category: 'Faith & Reading', icon: 'document', description: 'Urdu reading collection' },

  { id: 'health', name: 'Health', category: 'Personal', icon: 'health', description: 'Health utilities and monitoring' },
  { id: 'calendar', name: 'Calendar', category: 'Personal', icon: 'clock', description: 'Schedule and planning' },
  { id: 'reminders', name: 'Reminders', category: 'Personal', icon: 'timer', description: 'Personal reminder tools' },
  { id: 'habits', name: 'Habits', category: 'Personal', icon: 'tasks', description: 'Habit tracking' },
  { id: 'savings', name: 'Savings', category: 'Personal', icon: 'wallet', description: 'Savings planning tools' },
  { id: 'contacts', name: 'Contacts', category: 'Personal', icon: 'more', description: 'Account-scoped contacts' },
  { id: 'caller-id', name: 'Caller ID', category: 'Personal', icon: 'more', description: 'Android caller utilities' },
  { id: 'family', name: 'Family Hub', category: 'Personal', icon: 'more', description: 'Family-focused utilities' },

  { id: 'finance', name: 'Finance', category: 'Money & Commerce', icon: 'market', description: 'Finance and conversion tools' },
  { id: 'shopping', name: 'Shopping', category: 'Money & Commerce', icon: 'more', description: 'Shopping lists and discovery' },
  { id: 'marketplace', name: 'Marketplace', category: 'Money & Commerce', icon: 'more', description: 'Marketplace surface' },
  { id: 'orders', name: 'Orders', category: 'Money & Commerce', icon: 'document', description: 'Order tracking surface' },
  { id: 'growth', name: 'Growth Center', category: 'Money & Commerce', icon: 'market', description: 'Referral and growth tools' },

  { id: 'nova-vault', name: 'Nova Vault', category: 'Security & System', icon: 'vault', description: 'Server-backed Nova Vault features' },
  { id: 'file-vault', name: 'File Vault', category: 'Security & System', icon: 'vault', description: 'Protected file workflow' },
  { id: 'security', name: 'Security', category: 'Security & System', icon: 'vault', description: 'Security status and controls' },
  { id: 'notifications', name: 'Notifications', category: 'Security & System', icon: 'more', description: 'Notification preferences and status' },
  { id: 'settings', name: 'Settings', category: 'Security & System', icon: 'settings', description: 'Account, privacy and app settings' }
]);

export const categories = Object.freeze([...new Set(novaApps.map(app => app.category))]);
