import fs from 'fs/promises';
import path from 'path';
import * as github from '@actions/github';
import {
  fetchProfileData,
  renderContributionsSvg,
  themes,
} from './utils/contributions';

const outputDir = path.join(__dirname, '..', 'assets', 'contributions');

export const generate = async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');

  const login = process.env.GITHUB_USERNAME ?? 'antoniooodev';
  const octokit = github.getOctokit(token);
  const { days, languages } = await fetchProfileData(octokit, login, {
    excludeRepos: ['Unipd_Presentation'],
    hideLanguages: ['TeX'],
  });

  await fs.mkdir(outputDir, { recursive: true });
  for (const [name, theme] of Object.entries(themes)) {
    await fs.writeFile(
      path.join(outputDir, `${name}.svg`),
      renderContributionsSvg(days, languages, theme),
    );
  }
};

if (require.main === module) {
  generate().catch((error) => {
    console.error('Error generating contributions:', error);
    process.exit(1);
  });
}
