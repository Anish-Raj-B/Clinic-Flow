/**
 * Inline SVG icon set — the same glyphs as the original React icon module, so
 * no icon dependency is needed.
 */

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  box: '<path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5z"/><path d="m3 8.5 9 5.5 9-5.5M12 21v-7"/>',
  receipt:
    '<path d="M5 3v18l2.5-1.6L10 21l2-1.6L14 21l2.5-1.6L19 21V3l-2.5 1.6L14 3l-2 1.6L10 3 7.5 4.6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2.2.6 3.5 2.3 3.5 5.2"/>',
  shield:
    '<path d="M12 3 4.5 6v6c0 4.5 3.1 7.7 7.5 9 4.4-1.3 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10 3.05V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09c.24.65.85 1.1 1.55 1.1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.81z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17.5v.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  phone:
    '<path d="M6.5 3h-2A1.5 1.5 0 0 0 3 4.6C3 13 11 21 19.4 21a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.2-1.5l-3-.6a1.5 1.5 0 0 0-1.5.6l-1 1.3a14 14 0 0 1-5.1-5.1l1.3-1a1.5 1.5 0 0 0 .6-1.5l-.6-3A1.5 1.5 0 0 0 6.5 3z"/>',
  pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  pill:
    '<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M8.5 8.5 15.5 15.5"/>',
  sparkle:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  stethoscope:
    '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M4 3h4M12 3h4M10 12v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="10" r="2"/>',
  cross: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
};

export function icon(name, className = "icon") {
  const body = PATHS[name] || PATHS.cross;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Solid medical-cross glyph used inside the logo mark. */
export function crossGlyph(className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${PATHS.cross}</svg>`;
}
