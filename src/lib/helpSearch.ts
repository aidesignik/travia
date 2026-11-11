// Searching the Help page's questions (carrier.help.sections in messages).
// Shared by the Help page itself and the top bar's search results.

export interface HelpItem {
  q: string;
  a: string;
}

export interface HelpSection {
  id: string;
  title: string;
  items: HelpItem[];
}

// Case- and accent-insensitive, so "vozac" finds "vozač".
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** The sections and questions matching every word of `query` (all of them
 *  when it's empty), with empty sections dropped. */
export function filterHelp(sections: HelpSection[], query: string): HelpSection[] {
  const search = normalizeSearch(query);
  if (!search) return sections;
  const words = search.split(/\s+/);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const text = normalizeSearch(`${item.q} ${item.a} ${section.title}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.items.length > 0);
}
