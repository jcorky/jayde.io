// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD builders. Every field maps to visible, verified content — no invented
// social profiles, awards, certifications, reviews, employer details, or dates.
// ─────────────────────────────────────────────────────────────────────────────
import { SITE, SOCIALS } from './site';

const O = SITE.origin;
const PERSON_ID = `${O}/#person`;
const WEBSITE_ID = `${O}/#website`;

export function personSchema() {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Jayde Cork',
    jobTitle: 'Technical Trainer',
    worksFor: { '@type': 'Organization', name: 'Kaleris' },
    url: `${O}/`,
    image: `${O}/img/jayde-cork.jpg`,
    description:
      'Technical trainer with a background in logistics operations and enterprise software support. Designs and delivers training on Navis N4 and Master Terminal.',
    knowsAbout: [
      'Technical training',
      'Navis N4',
      'Master Terminal',
      'Enterprise software support',
      'Logistics operations',
      'Terminal operations',
      'Database and integration troubleshooting',
    ],
    // Verified profiles the owner provided — links this site to the same entity.
    sameAs: SOCIALS.map((s) => s.href),
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    url: `${O}/`,
    inLanguage: 'en',
    publisher: { '@id': PERSON_ID },
  };
}

export function profilePageSchema() {
  return {
    '@type': 'ProfilePage',
    '@id': `${O}/resume#profilepage`,
    url: `${O}/resume`,
    name: 'Jayde Cork — Resume',
    inLanguage: 'en',
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: { '@id': PERSON_ID },
    about: { '@id': PERSON_ID },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${O}${it.path}`,
    })),
  };
}

// Wrap one or more nodes in a single @graph document.
export function graph(nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
