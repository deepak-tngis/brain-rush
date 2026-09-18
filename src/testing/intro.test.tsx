import { act, render, screen } from '@testing-library/react-native';

import { IntroSequence } from '../components/IntroSequence';

/**
 * The launch animation.
 *
 * Two things matter here and neither is visible in a screenshot taken at the
 * wrong moment: every piece of branding is actually in the tree (an element
 * animated from `opacity: 0` that never mounts looks identical to one that is
 * merely early), and the sequence *finishes*. The second is the important one —
 * `onDone` is what reveals the app, so an animation that never calls it leaves
 * the player staring at a curtain they cannot dismiss.
 */
describe('the intro sequence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the full mark, wordmark and tagline', async () => {
    await render(<IntroSequence onDone={jest.fn()} />);

    expect(screen.getByText('BRAIN RUSH')).toBeTruthy();
    expect(screen.getByText('Think fast. Score faster.')).toBeTruthy();
  });

  it('hands over to the app once it has run', async () => {
    const onDone = jest.fn();
    await render(<IntroSequence onDone={onDone} />);

    expect(onDone).not.toHaveBeenCalled();

    // Well past the scripted run plus the fade, so a slow spring settling
    // cannot make this flake.
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops cleanly if it is torn down mid-flight', async () => {
    const onDone = jest.fn();
    const { unmount } = await render(<IntroSequence onDone={onDone} />);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await act(async () => unmount());
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    // A curtain that was torn down must not go on to reveal anything: calling
    // back here would be a state update against an unmounted tree.
    expect(onDone).not.toHaveBeenCalled();
  });
});
