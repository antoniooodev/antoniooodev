import {
  computeStats,
  fetchProfileData,
  renderContributionsSvg,
  themes,
  toLanguageShares,
} from '../../src/utils/contributions';

const day = (date: string, count: number) => ({ date, count });

describe('computeStats', () => {
  it('computes totals and streaks', () => {
    const days = [
      day('2026-10-20', 1),
      day('2026-10-21', 2),
      day('2026-10-22', 3),
      day('2026-10-23', 0),
      day('2026-10-24', 4),
      day('2026-10-25', 5),
    ];

    expect(computeStats(days)).toEqual({
      total: 15,
      currentStreak: 2,
      longestStreak: 3,
      activeDays: 5,
    });
  });

  it('keeps the current streak alive when today has no contributions yet', () => {
    const days = [
      day('2026-10-28', 1),
      day('2026-10-29', 1),
      day('2026-10-30', 0),
    ];

    expect(computeStats(days).currentStreak).toBe(2);
  });

  it('handles an empty calendar', () => {
    expect(computeStats([])).toEqual({
      total: 0,
      currentStreak: 0,
      longestStreak: 0,
      activeDays: 0,
    });
  });
});

describe('toLanguageShares', () => {
  it('returns the biggest languages with their percentage', () => {
    const sizes = new Map([
      ['Python', { color: '#3572A5', size: 300 }],
      ['JavaScript', { color: '#f1e05a', size: 600 }],
      ['C', { color: '#555555', size: 100 }],
    ]);

    expect(toLanguageShares(sizes, 2)).toEqual([
      { name: 'JavaScript', color: '#f1e05a', percent: 60 },
      { name: 'Python', color: '#3572A5', percent: 30 },
    ]);
  });

  it('returns nothing when there is no code', () => {
    expect(toLanguageShares(new Map())).toEqual([]);
  });
});

describe('fetchProfileData', () => {
  it('flattens the calendar and merges languages across repositories', async () => {
    const graphql = jest.fn().mockResolvedValue({
      user: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: [
              {
                contributionDays: [
                  { date: '2026-10-29', contributionCount: 1 },
                  { date: '2026-10-30', contributionCount: 3 },
                ],
              },
            ],
          },
        },
        repositories: {
          nodes: [
            {
              name: 'app',
              languages: {
                edges: [
                  { size: 30, node: { name: 'TypeScript', color: '#3178c6' } },
                  { size: 10, node: { name: 'TeX', color: '#3D6117' } },
                ],
              },
            },
            {
              name: 'lib',
              languages: {
                edges: [
                  { size: 10, node: { name: 'TypeScript', color: '#3178c6' } },
                  { size: 10, node: { name: 'Shell', color: null } },
                ],
              },
            },
            {
              name: 'slides',
              languages: {
                edges: [
                  { size: 500, node: { name: 'HTML', color: '#e34c26' } },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await fetchProfileData({ graphql } as any, 'someone', {
      excludeRepos: ['slides'],
      hideLanguages: ['TeX'],
    });

    expect(graphql).toHaveBeenCalledWith(expect.any(String), {
      login: 'someone',
    });
    expect(result.days).toEqual([day('2026-10-29', 1), day('2026-10-30', 3)]);
    expect(result.languages).toEqual([
      { name: 'TypeScript', color: '#3178c6', percent: 80 },
      { name: 'Shell', color: '#8b949e', percent: 20 },
    ]);
  });
});

describe('renderContributionsSvg', () => {
  const days = [
    day('2025-11-01', 0),
    day('2025-11-02', 4),
    day('2026-10-30', 2),
  ];

  it('renders one bar per day and the stats', () => {
    const svg = renderContributionsSvg(days, [], themes.dark);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.match(/<rect /g)).toHaveLength(3);
    expect(svg).toContain('aria-label="6 contributions in the last year"');
    expect(svg).toContain('Nov 2025');
    expect(svg).toContain(`fill="${themes.dark.accent}"`);
  });

  it('escapes language names', () => {
    const svg = renderContributionsSvg(
      days,
      [{ name: 'A&B', color: '#000000', percent: 100 }],
      themes.light,
    );

    expect(svg).toContain('A&amp;B 100%');
  });
});
