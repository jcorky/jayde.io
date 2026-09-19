// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for site-wide content and configuration.
// Edit copy here rather than in individual page templates.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE = {
  name: 'Jayde.IO',
  origin: 'https://jayde.io',
  title: 'Jayde.IO',
  owner: 'Jayde Cork',
  role: 'Technical Trainer',
  identityLine: 'Jayde Cork — Technical Trainer',
  email: 'Jayde.cork@gmail.com',
  locale: 'en',
  themeColor: '#000000',
} as const;

// Shared navigation. `current` is matched against the page pathname.
export const NAV: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Skills', href: '/skills' },
  { label: 'Contact', href: '/contact' },
];

// Owner-provided profiles. Used for visible footer links and the Person schema's
// sameAs (entity association). Add real profiles only — never invent one.
export const SOCIALS: { label: string; href: string }[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jaydecork' },
  { label: 'Instagram', href: 'https://www.instagram.com/jcorky' },
];

// Home biography — the owner's verified copy, punctuation lightly corrected.
export const BIO_PARAGRAPHS: string[] = [
  "I'm Jayde Cork, a Technical Trainer who makes complex enterprise software click for the people who use it.",
  "My path here wasn't a straight line, and that's exactly what makes my training different. I came up through the operational side of logistics, then moved into enterprise software support wrestling with databases, integrations, and the bugs that only surface in a live port. I've done that work for terminals around the world, pulling late-night shifts through go-lives and high-stakes takeovers, watching the software I support collide with the messy reality of a working port.",
  "Today, at Kaleris, I design and deliver training on Navis N4 and Master Terminal. These are the systems that keep cargo moving through some of the world's busiest ports. Whatever the format, the goal is the same: Help Others Win.",
];

// Skills — only areas supported by the biography. No fabricated proficiency
// scores, languages, certifications, years, or client names.
export const SKILLS: { title: string; body: string }[] = [
  {
    title: 'Technical training design & delivery',
    body: 'Building and delivering training that makes complex enterprise software click for the people who use it — whatever the format, in the room or remote.',
  },
  {
    title: 'Navis N4 & Master Terminal',
    body: 'Designing and delivering training on the terminal operating systems that keep cargo moving through some of the world’s busiest ports.',
  },
  {
    title: 'Enterprise software support',
    body: 'Years spent supporting enterprise software in production — translating between what the software does and what the operation actually needs.',
  },
  {
    title: 'Logistics & terminal operations',
    body: 'A background on the operational side of logistics, so training is grounded in how a working port really runs, not just how the software is meant to.',
  },
  {
    title: 'Database & integration troubleshooting',
    body: 'Comfortable in the weeds of databases, integrations, and the bugs that only surface in a live port.',
  },
  {
    title: 'Operational go-live support',
    body: 'Late-night shifts through go-lives and high-stakes takeovers, supporting terminals around the world when the stakes are highest.',
  },
];

// Resume — verified content only. Employment dates and any credential fields are
// left as editable drafts (see RESUME_DRAFTS) and are NOT rendered in production.
export const RESUME = {
  name: SITE.owner,
  role: SITE.role,
  website: 'jayde.io',
  email: SITE.email,
  summary:
    'Technical trainer with a background in logistics operations and enterprise software support. Designs and delivers training on Navis N4 and Master Terminal, drawing on experience with databases, integrations, and live port operations.',
  experience: [
    {
      title: 'Technical Trainer',
      org: 'Kaleris',
      dates: '', // intentionally unset until provided by the owner
      points: [
        'Designs and delivers training on Navis N4 and Master Terminal.',
        'Makes complex enterprise software click for the people who use it, across whatever training format fits the audience.',
      ],
    },
  ],
  earlierCareer:
    'Earlier career on the operational side of logistics, then in enterprise software support — wrestling with databases, integrations, and the bugs that only surface in a live port. That work spanned terminals around the world, including late-night shifts through go-lives and high-stakes takeovers.',
  coreSkills: [
    'Technical training design & delivery',
    'Navis N4 & Master Terminal',
    'Enterprise software support',
    'Logistics & terminal operations',
    'Database & integration troubleshooting',
    'Operational go-live support',
  ],
};

// Owner-editable draft fields. These are deliberately empty and are only shown
// in a clearly-marked draft preview (never on the production resume). Fill them
// in with verified facts, then surface them in resume.astro when ready.
export const RESUME_DRAFTS = {
  employmentDates: '', // e.g. "2023 – present"
  education: '', // e.g. "BSc ..., University of ..."
  certifications: [] as string[],
  additionalRoles: [] as string[],
  profileUrls: [] as { label: string; url: string }[], // e.g. LinkedIn — only if verified
  achievements: [] as string[],
  downloadablePdf: '', // path under /public if a real current PDF is generated
};

// Per-page SEO metadata. Descriptions are tuned to the visible copy.
export const PAGE_META = {
  home: {
    title: 'Jayde Cork — Technical Trainer | Jayde.IO',
    description:
      'Meet Jayde Cork, a technical trainer with a background in logistics and enterprise software support, designing training for Navis N4 and Master Terminal.',
  },
  blog: {
    title: 'Port Stories & Projects | Jayde.IO',
    description:
      "Project and port stories from Jayde Cork — notes from the terminals and the software that keeps cargo moving.",
  },
  skills: {
    title: 'Technical Training & Software Skills | Jayde.IO',
    description:
      "Explore Jayde Cork's experience in technical training, Navis N4, Master Terminal, logistics operations, and enterprise software support.",
  },
  resume: {
    title: 'Jayde Cork — Resume | Jayde.IO',
    description:
      "View Jayde Cork's resume, including technical training at Kaleris and a background in logistics and enterprise software support.",
  },
  contact: {
    title: 'Contact Jayde Cork | Jayde.IO',
    description:
      'Get in touch with Jayde Cork through the Jayde.IO contact form or email.',
  },
  notFound: {
    title: 'Page not found | Jayde.IO',
    description: 'That page could not be found. Head back to Jayde.IO.',
  },
} as const;

// Routes included in sitemap.xml. Panama (noindex placeholder), redirects, the
// retired page, the API, and error pages are intentionally excluded.
// `lastmod` reflects genuine content changes, not the deploy time.
export const SITEMAP_ROUTES: { path: string; lastmod: string; priority: string }[] = [
  { path: '/', lastmod: '2026-09-18', priority: '1.0' },
  { path: '/blog', lastmod: '2026-09-18', priority: '0.8' },
  { path: '/skills', lastmod: '2026-09-18', priority: '0.7' },
  { path: '/contact', lastmod: '2026-09-18', priority: '0.6' },
];
