import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactElement } from 'react';

import DailyScreen from '../../app/daily';
import GameScreen from '../../app/game';
import GameOverScreen from '../../app/game-over';
import HomeScreen from '../../app/index';
import SettingsScreen from '../../app/settings';
import StatsScreen from '../../app/stats';
import { GameProvider, useGame } from '../state/GameProvider';
import { __resetForTests } from '../storage/progressStore';

/**
 * Screen smoke tests.
 *
 * These render the real screens against the real engine and the real save file,
 * with only native modules stubbed. They are the closest check available without
 * a device for "the app launches" and "all screens are navigable" — and since
 * the ad SDK is deliberately made unavailable in `setupUiTests.ts`, they also
 * prove the game is fully playable when ads cannot load at all.
 */

const pushed: string[] = [];
const replaced: string[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (path: string) => pushed.push(path),
    replace: (path: string) => replaced.push(path),
    back: () => pushed.push('back'),
  }),
}));

const insets = { top: 24, bottom: 12, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

async function renderScreen(element: ReactElement): Promise<void> {
  await render(
    <SafeAreaProvider initialMetrics={{ insets, frame }}>
      <GameProvider>{element}</GameProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  pushed.length = 0;
  replaced.length = 0;
  __resetForTests();
});

describe('every screen renders', () => {
  it('shows the player their headline numbers on Home', async () => {
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('BRAIN RUSH')).toBeTruthy();
    expect(screen.getByText('PLAY')).toBeTruthy();
    expect(screen.getByText('Daily Challenge')).toBeTruthy();
    // The starting balance, read straight from the save file.
    expect(screen.getByText('300')).toBeTruthy();
  });

  it('navigates from Home to every other screen', async () => {
    await renderScreen(<HomeScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Statistics'));
    });
    expect(pushed).toContain('/stats');

    await act(async () => {
      fireEvent.press(screen.getByText('Settings'));
    });
    expect(pushed).toContain('/settings');

    await act(async () => {
      fireEvent.press(screen.getByText('Daily Challenge'));
    });
    expect(pushed).toContain('/daily');

    await act(async () => {
      fireEvent.press(screen.getByText('PLAY'));
    });
    expect(pushed).toContain('/game');
  });

  it('renders the Daily Challenge screen', async () => {
    await renderScreen(<DailyScreen />);
    expect(screen.getByText('Daily Challenge')).toBeTruthy();
    expect(screen.getByText('Start the challenge')).toBeTruthy();
  });

  it('renders Statistics with an empty save', async () => {
    await renderScreen(<StatsScreen />);
    expect(screen.getByText('Statistics')).toBeTruthy();
    expect(screen.getByText('Play a round and your strengths will show up here.')).toBeTruthy();
  });

  it('renders Settings and says so when adverts are unavailable', async () => {
    await renderScreen(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Sound effects')).toBeTruthy();
    expect(
      screen.getByText(
        'Adverts are unavailable in this build. Everything else works exactly the same.',
      ),
    ).toBeTruthy();
  });
});

/** Starts an endless run, then renders the board for it. */
function PlayHarness(): ReactElement {
  const { session, start } = useGame();
  if (session === null) {
    start('endless');
    return <></>;
  }
  return <GameScreen />;
}

describe('playing', () => {
  it('renders a puzzle with a full HUD and tappable answers', async () => {
    await renderScreen(<PlayHarness />);

    await waitFor(() => expect(screen.getByText('Question 1')).toBeTruthy());
    expect(screen.getByText('Score')).toBeTruthy();
    expect(screen.getByText('Coins')).toBeTruthy();
    expect(screen.getByText('Streak')).toBeTruthy();
    // Every generated puzzle offers at least four answers.
    expect(screen.getAllByRole('radio').length).toBeGreaterThanOrEqual(4);
  });

  it('accepts an answer and carries on with no ad SDK present', async () => {
    await renderScreen(<PlayHarness />);
    await waitFor(() => expect(screen.getByText('Question 1')).toBeTruthy());

    const options = screen.getAllByRole('radio');
    await act(async () => {
      fireEvent.press(options[0] as never);
    });

    // The board is still alive: the answer was scored rather than crashing on
    // the missing ad module.
    await waitFor(() => expect(screen.getByText('Score')).toBeTruthy());
  });

  it('offers a hint and explains itself when no advert can be served', async () => {
    await renderScreen(<PlayHarness />);
    await waitFor(() => expect(screen.getByText('Reveal the answer')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Reveal the answer'));
    });
    expect(screen.getByText('Need a hint?')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Watch and reveal'));
    });

    // No SDK means no reward — and the player is told, not left waiting.
    await waitFor(() =>
      expect(
        screen.getByText('No advert available right now. Carry on - nothing is lost.'),
      ).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByText('No thanks'));
    });
    expect(screen.queryByText('Need a hint?')).toBeNull();
  });
});

/** Drives a run into a game over so the end screen renders against real state. */
function GameOverHarness(): ReactElement {
  const { session, start, submit } = useGame();

  if (session === null) {
    start('endless');
    return <></>;
  }
  if (session.status === 'playing') {
    const puzzle = session.puzzles[session.index];
    const wrong = puzzle?.options.find((option) => option.id !== puzzle.answerId);
    submit(wrong?.id ?? null, 500);
    return <></>;
  }
  return <GameOverScreen />;
}

describe('game over', () => {
  it('renders the end of a run with a way back into the game', async () => {
    await renderScreen(<GameOverHarness />);

    await waitFor(() => expect(screen.getByText('Out of lives')).toBeTruthy());
    expect(screen.getByText('Play again')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    // A run can be revived exactly once, so the offer is present here.
    expect(screen.getByText('Continue this run')).toBeTruthy();
  });
});
