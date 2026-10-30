import {
  generateActionsMarkdown,
  generateHandMarkdown,
  generateHistoryMarkdown,
  generateStatusMarkdown,
  updateReadmeContent,
} from '../../src/utils/readme';
import { GameState, HandCard, HistoryEntry } from '../../src/types';
import fs from 'fs/promises';

jest.mock('fs/promises');

describe('readme.ts', () => {
  describe('generateHandMarkdown', () => {
    const cards: HandCard[] = [
      { rank: 'A', suit: 's', hidden: false },
      { rank: 'K', suit: 'd', hidden: true },
    ];

    it('should render card images and hide the hole card', () => {
      const result = generateHandMarkdown('Dealer', cards);
      expect(result).toContain(
        '<img width="70" src="assets/cards/AS.svg" alt="As" />',
      );
      expect(result).toContain(
        '<img width="70" src="assets/cards/RED_BACK.svg" alt="Hidden card" />',
      );
    });

    it('should only count visible cards', () => {
      expect(generateHandMarkdown('Dealer', cards)).toContain(
        '<b>Dealer</b>&nbsp;&nbsp;·&nbsp;&nbsp;11 + ?',
      );
    });

    it('should put the label above the dealer and below the player', () => {
      const dealer = generateHandMarkdown('Dealer', cards);
      const player = generateHandMarkdown('Player', cards);
      expect(dealer.indexOf('<b>Dealer</b>')).toBeLessThan(
        dealer.indexOf('<img'),
      );
      expect(player.indexOf('<b>Player</b>')).toBeGreaterThan(
        player.indexOf('<img'),
      );
    });
  });

  describe('generateStatusMarkdown', () => {
    const baseState: GameState = {
      dealer: [],
      player: [],
      history: [],
      isFinished: false,
      deck: [],
    };

    it('should ask for a move while the game is running', () => {
      expect(generateStatusMarkdown(baseState)).toBe(
        "Player's turn · Hit or Stand?",
      );
    });

    it('should describe the result of a finished game', () => {
      const gameState: GameState = {
        ...baseState,
        isFinished: true,
        winner: 'Player',
        history: [
          {
            action: 'Stand',
            actor: 'agonyz',
            cardsInPlay: [],
            events: [
              { step: 'Dealer: Draw Card', cardsInPlay: [] },
              { step: 'Player won: Dealer busted', cardsInPlay: [] },
              {
                step: 'Game Finished: Thank you for playing!',
                cardsInPlay: [],
              },
            ],
          },
        ],
      };
      expect(generateStatusMarkdown(gameState)).toBe(
        'Player wins · dealer busts',
      );
    });
  });

  describe('generateActionsMarkdown', () => {
    const gameState: GameState = {
      dealer: [],
      player: [],
      history: [],
      isFinished: false,
      deck: [],
    };

    it('should offer every move while the game is running', () => {
      const result = generateActionsMarkdown(gameState);
      expect(result).toContain('alt="Hit"');
      expect(result).toContain('alt="Stand"');
      expect(result).toContain('alt="New Game"');
      expect(result).toContain(
        'https://github.com/antoniooodev/antoniooodev/issues/new?title=Blackjack%3A%20Hit',
      );
    });

    it('should only offer a new game once the game is finished', () => {
      const result = generateActionsMarkdown({
        ...gameState,
        isFinished: true,
      });
      expect(result).not.toContain('alt="Hit"');
      expect(result).not.toContain('alt="Stand"');
      expect(result).toContain('title=Blackjack%3A%20New%20Game');
    });
  });

  describe('generateHistoryMarkdown', () => {
    it('should generate one line per action', () => {
      const history: HistoryEntry[] = [
        { action: 'Hit', actor: 'agonyz', events: [], cardsInPlay: [] },
        { action: 'Stand', actor: 'someone', cardsInPlay: [] },
      ];
      expect(generateHistoryMarkdown(history)).toBe(
        '- **Hit** by [agonyz](https://github.com/agonyz)\n' +
          '- **Stand** by [someone](https://github.com/someone)',
      );
    });

    it('should link the Dealer', () => {
      const history: HistoryEntry[] = [
        { action: 'Hit', actor: 'Dealer', cardsInPlay: [] },
      ];
      expect(generateHistoryMarkdown(history)).toBe(
        '- **Hit** by [Dealer](https://github.com/agonyz)',
      );
    });

    it('should list the events of an action', () => {
      const history: HistoryEntry[] = [
        {
          action: 'Hit',
          actor: 'agonyz',
          events: [
            { step: 'Player: Draw Card', cardsInPlay: [] },
            { step: 'Dealer: Draw Card', cardsInPlay: [] },
          ],
          cardsInPlay: [],
        },
      ];
      expect(generateHistoryMarkdown(history)).toContain(
        '<br/><sub>Player: Draw Card → Dealer: Draw Card</sub>',
      );
    });
  });

  describe('updateReadmeContent', () => {
    it('should update README content', async () => {
      const gameState: GameState = {
        dealer: [{ rank: 'A', suit: 's', hidden: false }],
        player: [{ rank: 'K', suit: 'd', hidden: false }],
        history: [],
        winner: 'Player',
        isFinished: false,
        deck: [],
      };
      const fakeReadmeContent =
        '## Introduction\n<!-- blackjack-area -->\nOld content\n<!-- /blackjack-area -->\n## Footer';

      (fs.readFile as jest.Mock).mockResolvedValue(fakeReadmeContent);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await updateReadmeContent(gameState);

      const expectedNewContent = expect.stringMatching(
        /<!-- blackjack-area -->\n[\s\S]*<b>Dealer<\/b>[\s\S]*<!-- \/blackjack-area -->\n## Footer$/,
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        expectedNewContent,
        'utf-8',
      );
    });

    it('should handle missing markers in README', async () => {
      const gameState: GameState = {
        dealer: [],
        player: [],
        history: [],
        winner: 'Player',
        isFinished: false,
        deck: [],
      };
      const fakeReadmeContent = '## Introduction\nSome content\n## Footer';

      (fs.readFile as jest.Mock).mockResolvedValue(fakeReadmeContent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await updateReadmeContent(gameState);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Markers not found in README.md',
      );
      consoleErrorSpy.mockRestore();
    });

    it('should log an error if reading the README fails', async () => {
      const gameState: GameState = {
        dealer: [],
        player: [],
        history: [],
        winner: 'Player',
        isFinished: false,
        deck: [],
      };
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await updateReadmeContent(gameState);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating README:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
