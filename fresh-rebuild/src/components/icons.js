const paths = {
  mine: '<path d="M13.7 2.8 6.8 13h4.5l-1 8.2L17.2 11h-4.5l1-8.2Z" fill="currentColor"/><circle cx="12" cy="12" r="9" opacity=".22"/>',
  hub: '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8Z"/><path d="M8.2 15.8V8.2l7.6 7.6V8.2"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 9h18M15.5 13.2h3"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  market: '<path d="M4 18V9l4 3 4-6 4 5 4-3v10M4 18h16"/>',
  notes: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>',
  todo: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2"/>',
  convert: '<path d="M7 7h12l-3-3M17 17H5l3 3"/><path d="M19 7l-3 3M5 17l3-3"/>',
  expense: '<path d="M4 7h16v12H4z"/><path d="M7 7V5h10v2M8 13h8M12 10v6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/>',
  health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/><path d="M8 12h2l1-2 2 5 1-3h2"/>',
  tip: '<circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><path d="M7 17 17 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-2zM14 18h2v2h-2z"/>',
  weather: '<path d="M8 17h9a4 4 0 0 0 .2-8A6 6 0 0 0 6 11a3 3 0 0 0 2 6Z"/><path d="M7 5 5.5 3.5M12 4V2M3 10H1"/>',
  prayer: '<path d="M4 20h16M6 20v-8a6 6 0 0 1 12 0v8M12 4V2M9 7h6"/>',
  browser: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  qibla: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  speed: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/><path d="M7 15h.01M17 15h.01M12 8h.01"/>',
  news: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  travel: '<path d="M4 16 20 8l-6 12-2-5-5-2Z"/><path d="m12 15 2-2"/>',
  teacher: '<path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c3 2 7 2 10 0v-5M21 8v6"/>',
  ai: '<rect x="5" y="6" width="14" height="12" rx="4"/><path d="M9 11h.01M15 11h.01M9 15h6M12 6V3"/>',
  document: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>',
  vault: '<rect x="4" y="5" width="16" height="15" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 15v3M9 12H7M15 12h2"/>',
  location: '<path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/>',
  emergency: '<path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 8v5M12 16.5h.01"/>',
  drive: '<path d="M5 16.5 6.7 9h10.6l1.7 7.5"/><path d="M4 16.5h16v3H4zM7 13h10M7 19.5v1M17 19.5v1"/><circle cx="7" cy="16.5" r="1"/><circle cx="17" cy="16.5" r="1"/>',
  track: '<path d="M4 18c4-1 4-5 8-6s4-5 8-6"/><circle cx="4" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="6" r="2"/>',
  smart: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="4"/>',
  analytics: '<path d="M5 19V11M10 19V5M15 19v-8M20 19V8"/><path d="M3 19h19"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4L19 13a7 7 0 0 0 .1-1Z"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'
};

export function icon(name, className = '') {
  const body = paths[name] || paths.more;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
