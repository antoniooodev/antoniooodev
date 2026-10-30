import fs from 'fs/promises';
import path from 'path';
import { CardOwner, GameState, HandCard, HistoryEntry, Step } from '../types';
import { calculateHandValue } from './hand';

const readmePath = path.join(__dirname, '..', '..', 'README.md');

const resultMessages: Partial<Record<Step, string>> = {
  'Player won: Dealer busted': 'Player wins · dealer busts',
  'Player won: Is closer to 21': 'Player wins · closer to 21',
  'Dealer won: Player busted': 'Dealer wins · player busts',
  'Dealer won: Is closer to 21': 'Dealer wins · closer to 21',
  'Tie: Both parties busted': 'Push · both bust',
  'Tie: Both parties are equally close to 21': 'Push · same total',
};

// The first available move is the suggested one and gets the accent color.
const primaryColor = '238636';
const secondaryColor = '30363d';

const getRepository = () =>
  process.env.GITHUB_REPOSITORY ?? 'antoniooodev/antoniooodev';

export const generateHandMarkdown = (
  owner: CardOwner,
  cards: HandCard[],
): string => {
  const hasHiddenCard = cards.some((card) => card.hidden);
  const value = `${calculateHandValue(cards, true)}${hasHiddenCard ? ' + ?' : ''}`;

  const images = cards
    .map((card) => {
      const filename = card.hidden ? 'RED_BACK' : `${card.rank}${card.suit}`;
      const alt = card.hidden ? 'Hidden card' : `${card.rank}${card.suit}`;
      return `<img width="70" src="assets/cards/${filename.toUpperCase()}.svg" alt="${alt}" />`;
    })
    .join('&nbsp;');

  const label = `<p align="center"><b>${owner}</b>&nbsp;&nbsp;·&nbsp;&nbsp;${value}</p>`;
  const hand = `<p align="center">${images}</p>`;

  // The dealer sits on top of the table, the player at the bottom.
  return owner === 'Dealer' ? `${label}\n${hand}` : `${hand}\n${label}`;
};

export const generateStatusMarkdown = (gameState: GameState): string => {
  if (!gameState.isFinished) {
    return "Player's turn · Hit or Stand?";
  }

  const steps = gameState.history.flatMap(
    (entry) => entry.events?.map((event) => event.step) ?? [],
  );
  const result = steps.reverse().find((step) => resultMessages[step]);

  return result ? resultMessages[result]! : 'Game over';
};

export const generateActionsMarkdown = (gameState: GameState): string => {
  const actions = gameState.isFinished
    ? (['New Game'] as const)
    : (['Hit', 'Stand', 'New Game'] as const);
  const body = encodeURIComponent(
    "Please don't change anything in this issue. To execute your action simply submit the issue.",
  );

  return actions
    .map((action, index) => {
      const color = index === 0 ? primaryColor : secondaryColor;
      const title = encodeURIComponent(`Blackjack: ${action}`);
      const badge = `https://img.shields.io/badge/${encodeURIComponent(action)}-${color}?style=for-the-badge`;
      return `<a href="https://github.com/${getRepository()}/issues/new?title=${title}&body=${body}"><img src="${badge}" alt="${action}" /></a>`;
    })
    .join('\n  ');
};

export const generateHistoryMarkdown = (history: HistoryEntry[]): string => {
  return history
    .map(({ action, events, actor }) => {
      const actorUrl =
        actor === 'Dealer'
          ? '[Dealer](https://github.com/agonyz)'
          : `[${actor}](https://github.com/${actor})`;
      const steps = events?.length
        ? `<br/><sub>${events.map(({ step }) => step).join(' → ')}</sub>`
        : '';
      return `- **${action}** by ${actorUrl}${steps}`;
    })
    .join('\n');
};

export const updateReadmeContent = async (
  gameState: GameState,
): Promise<void> => {
  try {
    let readmeContent = await fs.readFile(readmePath, 'utf-8');
    const newContent = `
${generateHandMarkdown('Dealer', gameState.dealer)}

<h3 align="center">${generateStatusMarkdown(gameState)}</h3>

${generateHandMarkdown('Player', gameState.player)}

<p align="center">
  ${generateActionsMarkdown(gameState)}
</p>

<details>
<summary>Game history</summary>

${generateHistoryMarkdown(gameState.history)}

</details>
`;

    const startMarker = '<!-- blackjack-area -->';
    const endMarker = '<!-- /blackjack-area -->';
    const startIndex = readmeContent.indexOf(startMarker);
    const endIndex = readmeContent.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
      console.error('Markers not found in README.md');
      return;
    }
    readmeContent = `${readmeContent.substring(0, startIndex + startMarker.length)}\n${newContent}\n${readmeContent.substring(endIndex)}`;

    await fs.writeFile(readmePath, readmeContent, 'utf-8');
  } catch (error) {
    console.error('Error updating README:', error);
  }
};
