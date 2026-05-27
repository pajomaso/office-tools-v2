// Brand color tokens
export const SITE = {
  paper:     '#f4f1e8',
  paperWarm: '#ece9df',
  paperDeep: '#e8e3d4',
  ink:       '#1a1a1a',
  inkSoft:   '#3a3a3a',
  mute:      '#6e6a5e',
  rule:      '#d8d3c4',
  limestone: '#efebe0',
  green:     '#1F8A5B',
  blue:      '#2A6FDB',
  red:       '#C8412A',
  ochre:     '#D69A2F',
  purple:    '#7C5BC4',
  teal:      '#1f8a8a',
} as const;

export const SITE_PALETTE = { dark: SITE.ink, light: SITE.limestone, accent: SITE.green };
export const INVERSE_PALETTE_HOME = { dark: SITE.limestone, light: SITE.ink, accent: SITE.green };

// Theme definitions
export const THEMES = [
  { key: 'web',      label: 'Web',         color: SITE.blue },
  { key: 'ai',       label: 'AI / Data',   color: SITE.purple },
  { key: 'devops',   label: 'DevOps',      color: SITE.teal },
  { key: 'mobile',   label: 'Mobile',      color: SITE.ochre },
  { key: 'design',   label: 'Design',      color: SITE.red },
  { key: 'security', label: 'Security',    color: SITE.ink },
  { key: 'oss',      label: 'Open Source', color: SITE.green },
  { key: 'career',   label: 'Career',      color: SITE.mute },
  { key: 'hardware', label: 'Hardware',    color: SITE.red },
] as const;

export type ThemeKey = typeof THEMES[number]['key'];

export const CITIES = ['All cities', 'Lisboa', 'Porto', 'Coimbra', 'Braga', 'Aveiro', 'Évora', 'Faro', 'Funchal'] as const;

export interface Community {
  id: string;
  name: string;
  city: string;
  themes: ThemeKey[];
  members: string;
  orgCount: number;
  accent: string;
  founded: number;
  blurb: string;
}

export const COMMUNITIES: Community[] = [
  { id: 'react-lisbon',     name: 'React Lisbon',            city: 'Lisboa',  themes: ['web'],              members: '1.4k', orgCount: 28, accent: SITE.blue,   founded: 2017, blurb: 'Monthly meetups on React, the web platform, and modern JS.' },
  { id: 'porto-js',         name: 'Porto.JS',                city: 'Porto',   themes: ['web'],              members: '900',  orgCount: 22, accent: SITE.blue,   founded: 2018, blurb: 'JavaScript and web platform talks, every second Thursday.' },
  { id: 'coimbra-ml',       name: 'Coimbra ML',              city: 'Coimbra', themes: ['ai'],               members: '620',  orgCount: 31, accent: SITE.purple, founded: 2019, blurb: "One of Portugal's longest-running machine learning communities." },
  { id: 'devops-porto',     name: 'DevOps Porto',            city: 'Porto',   themes: ['devops', 'oss'],    members: '780',  orgCount: 19, accent: SITE.teal,   founded: 2018, blurb: 'Practical DevOps, infra, platform engineering — beginner-friendly.' },
  { id: 'python-pt',        name: 'Python Portugal',         city: 'Lisboa',  themes: ['ai', 'web', 'oss'], members: '2.1k', orgCount: 41, accent: SITE.green,  founded: 2014, blurb: 'PyConPT organizers; year-round events for the whole country.' },
  { id: 'sw-crafters',      name: 'Lisbon Software Crafters',city: 'Lisboa',  themes: ['career', 'web'],    members: '510',  orgCount: 24, accent: SITE.ochre,  founded: 2016, blurb: 'Code dojos, mob programming, talks on craft and design.' },
  { id: 'braga-it',         name: 'Braga IT',                city: 'Braga',   themes: ['career', 'web'],    members: '440',  orgCount: 17, accent: SITE.ochre,  founded: 2019, blurb: 'Northern tech community meeting in U.Minho — open to all.' },
  { id: 'aveiro-talks',     name: 'Aveiro Tech Talks',       city: 'Aveiro',  themes: ['web', 'hardware'],  members: '320',  orgCount: 14, accent: SITE.red,    founded: 2020, blurb: 'Bi-monthly tech talks at Glicínias — a bit of everything.' },
  { id: 'cybersec-lx',      name: 'Cybersec Lisbon',         city: 'Lisboa',  themes: ['security'],         members: '690',  orgCount: 16, accent: SITE.ink,    founded: 2018, blurb: 'CTFs, threat-modeling, and a quarterly mini-conf.' },
  { id: 'mobile-pt',        name: 'Mobile Portugal',         city: 'Porto',   themes: ['mobile'],           members: '550',  orgCount: 21, accent: SITE.ochre,  founded: 2017, blurb: 'iOS, Android, Flutter, React Native — one event each, every month.' },
  { id: 'design-engineers', name: 'Design Engineers PT',     city: 'Lisboa',  themes: ['design', 'web'],    members: '380',  orgCount: 9,  accent: SITE.red,    founded: 2023, blurb: 'For people who sit between design and engineering.' },
  { id: 'algarve-hackers',  name: 'Algarve Hackers',         city: 'Faro',    themes: ['hardware', 'oss'],  members: '210',  orgCount: 12, accent: SITE.red,    founded: 2019, blurb: 'Hardware, IoT, hackathons. Where the algarvios build.' },
];

export function communityById(id: string): Community {
  return COMMUNITIES.find(c => c.id === id)!;
}

// Event date helpers
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const WEEKDAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function dt(day: number, month: number, year: number, hour: number, min: number) {
  const d = new Date(year, month - 1, day, hour, min);
  return {
    day, month, year, hour, min,
    wd: WEEKDAYS[d.getDay()],
    mo: MONTHS[month - 1],
    time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
}

export interface Event {
  id: string;
  commId: string;
  title: string;
  when: ReturnType<typeof dt>;
  city: string;
  venue: string;
}

export const EVENTS: Event[] = [
  { id: 'e01', commId: 'react-lisbon',    title: 'State of React Server Components',          when: dt(11, 6, 2026, 19, 30), city: 'Lisboa',  venue: 'LX Factory · Sala B' },
  { id: 'e02', commId: 'devops-porto',    title: 'Platform engineering at a 200-person co.',  when: dt(12, 6, 2026, 18, 30), city: 'Porto',   venue: 'UPTEC · Auditório' },
  { id: 'e03', commId: 'coimbra-ml',      title: 'Embeddings, in practice',                   when: dt(13, 6, 2026, 10, 30), city: 'Coimbra', venue: 'DEI · Anfiteatro 1' },
  { id: 'e04', commId: 'sw-crafters',     title: 'Mob programming — bring a laptop',          when: dt(15, 6, 2026, 19, 0),  city: 'Lisboa',  venue: 'Beato Innovation District' },
  { id: 'e05', commId: 'python-pt',       title: 'PyConPT 2026 · Call for Speakers closes',   when: dt(16, 6, 2026, 23, 59), city: 'Online',  venue: 'Online' },
  { id: 'e06', commId: 'porto-js',        title: 'Edge runtimes & the new web stack',         when: dt(18, 6, 2026, 19, 30), city: 'Porto',   venue: 'Porto i/o · Vitoria' },
  { id: 'e07', commId: 'cybersec-lx',     title: 'Threat modeling for product teams',         when: dt(19, 6, 2026, 18, 30), city: 'Lisboa',  venue: 'Hub Criativo do Beato' },
  { id: 'e08', commId: 'braga-it',        title: 'Career night — recruiter Q&A',              when: dt(20, 6, 2026, 19, 0),  city: 'Braga',   venue: 'U.Minho · CP1' },
  { id: 'e09', commId: 'mobile-pt',       title: 'Building offline-first mobile apps',        when: dt(23, 6, 2026, 19, 0),  city: 'Porto',   venue: 'Porto Tech Hub' },
  { id: 'e10', commId: 'aveiro-talks',    title: 'Open mic — lightning talks',                when: dt(24, 6, 2026, 19, 0),  city: 'Aveiro',  venue: 'Glicínias · Sala 2' },
  { id: 'e11', commId: 'design-engineers',title: 'Designing developer tools',                 when: dt(26, 6, 2026, 19, 0),  city: 'Lisboa',  venue: 'Second Home' },
  { id: 'e12', commId: 'algarve-hackers', title: 'Build night — soldering & breadboards',     when: dt(28, 6, 2026, 14, 0),  city: 'Faro',    venue: 'Casa do Povo' },
];
