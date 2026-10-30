import { GitHub } from '@actions/github/lib/utils';

export interface ContributionDay {
  date: string;
  count: number;
}

export interface LanguageShare {
  name: string;
  color: string;
  percent: number;
}

export interface ContributionStats {
  total: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
}

export interface Theme {
  text: string;
  muted: string;
  bar: string;
  accent: string;
}

export const themes: Record<'dark' | 'light', Theme> = {
  dark: {
    text: '#e6edf3',
    muted: '#7d8590',
    bar: '#e6edf3',
    accent: '#3fb950',
  },
  light: {
    text: '#1f2328',
    muted: '#656d76',
    bar: '#1f2328',
    accent: '#1a7f37',
  },
};

const query = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        nodes {
          name
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

interface QueryResult {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        weeks: {
          contributionDays: { date: string; contributionCount: number }[];
        }[];
      };
    };
    repositories: {
      nodes: {
        name: string;
        languages: {
          edges: {
            size: number;
            node: { name: string; color: string | null };
          }[];
        };
      }[];
    };
  };
}

export const fetchProfileData = async (
  octokit: InstanceType<typeof GitHub>,
  login: string,
  options: { excludeRepos?: string[]; hideLanguages?: string[] } = {},
) => {
  const { user } = await octokit.graphql<QueryResult>(query, { login });

  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((week) => week.contributionDays)
    .map((day) => ({ date: day.date, count: day.contributionCount }));

  const sizes = new Map<string, { color: string; size: number }>();
  user.repositories.nodes
    .filter((repo) => !options.excludeRepos?.includes(repo.name))
    .flatMap((repo) => repo.languages.edges)
    .filter((edge) => !options.hideLanguages?.includes(edge.node.name))
    .forEach((edge) => {
      const current = sizes.get(edge.node.name);
      sizes.set(edge.node.name, {
        color: edge.node.color ?? '#8b949e',
        size: (current?.size ?? 0) + edge.size,
      });
    });

  return { days, languages: toLanguageShares(sizes) };
};

export const toLanguageShares = (
  sizes: Map<string, { color: string; size: number }>,
  limit = 5,
): LanguageShare[] => {
  const total = [...sizes.values()].reduce((sum, l) => sum + l.size, 0);
  if (total === 0) return [];

  return [...sizes.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, limit)
    .map(([name, { color, size }]) => ({
      name,
      color,
      percent: (size / total) * 100,
    }));
};

export const computeStats = (days: ContributionDay[]): ContributionStats => {
  let longestStreak = 0;
  let run = 0;
  days.forEach((day) => {
    run = day.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  });

  // Today is not over yet: a streak is still alive if it ended yesterday.
  let end = days.length - 1;
  if (end >= 0 && days[end].count === 0) end--;
  let currentStreak = 0;
  for (let i = end; i >= 0 && days[i].count > 0; i--) currentStreak++;

  return {
    total: days.reduce((sum, day) => sum + day.count, 0),
    currentStreak,
    longestStreak,
    activeDays: days.filter((day) => day.count > 0).length,
  };
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatMonth = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const round = (value: number) => Math.round(value * 100) / 100;

export const renderContributionsSvg = (
  days: ContributionDay[],
  languages: LanguageShare[],
  theme: Theme,
): string => {
  const width = 840;
  const height = languages.length > 0 ? 250 : 215;
  const waveTop = 92;
  const waveHeight = 96;
  const centerY = waveTop + waveHeight / 2;
  const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
  const mono = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace`;

  const stats = computeStats(days);
  const max = Math.max(1, ...days.map((day) => day.count));
  const step = width / Math.max(1, days.length);
  const barWidth = Math.max(1, step * 0.55);

  const bars = days
    .map((day, i) => {
      // Square root keeps a single busy day from flattening the rest.
      const half = Math.max(
        barWidth / 2,
        Math.sqrt(day.count / max) * (waveHeight / 2),
      );
      const isToday = i === days.length - 1;
      return `<rect x="${round(i * step + (step - barWidth) / 2)}" y="${round(centerY - half)}" width="${round(barWidth)}" height="${round(half * 2)}" rx="${round(barWidth / 2)}"${isToday ? ` fill="${theme.accent}"` : ''} style="animation-delay:${Math.round(i * 2.5)}ms"><title>${day.date}: ${day.count}</title></rect>`;
    })
    .join('');

  const statColumns = [
    { value: stats.currentStreak, label: 'current streak' },
    { value: stats.longestStreak, label: 'longest streak' },
    { value: stats.activeDays, label: 'active days' },
  ]
    .map(
      (stat, i) => `
    <text x="${width - i * 140}" y="38" text-anchor="end" class="value">${stat.value}</text>
    <text x="${width - i * 140}" y="60" text-anchor="end" class="label">${stat.label}</text>`,
    )
    .join('');

  let languageX = 0;
  const languageRow = languages
    .map((language) => {
      const label = `${escapeXml(language.name)} ${language.percent.toFixed(0)}%`;
      const item = `
    <circle cx="${languageX + 4}" cy="${height - 9}" r="4" fill="${escapeXml(language.color)}"/>
    <text x="${languageX + 14}" y="${height - 5}" class="label">${label}</text>`;
      languageX += 14 + label.length * 7.2 + 22;
      return item;
    })
    .join('');

  const first = days[0]?.date;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${stats.total} contributions in the last year">
  <style>
    .total { font: 600 34px ${font}; fill: ${theme.text}; }
    .value { font: 600 20px ${font}; fill: ${theme.text}; }
    .label { font: 400 12px ${mono}; fill: ${theme.muted}; }
    .wave rect { transform-box: fill-box; transform-origin: center; animation: grow 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes grow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .wave rect { animation: none; } }
  </style>
  <defs>
    <linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">
      <stop offset="0" stop-color="${theme.bar}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${theme.bar}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <text x="0" y="40" class="total">${stats.total.toLocaleString('en-US')}</text>
  <text x="0" y="62" class="label">contributions in the last year</text>${statColumns}
  <g class="wave" fill="url(#fade)">${bars}</g>
  <text x="0" y="${waveTop + waveHeight + 20}" class="label">${first ? formatMonth(first) : ''}</text>
  <text x="${width}" y="${waveTop + waveHeight + 20}" text-anchor="end" class="label">today</text>${languageRow}
</svg>
`;
};
