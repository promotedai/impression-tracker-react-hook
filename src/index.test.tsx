/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import {
  Impression,
  WithImpressionTrackerProps,
  useImpressionTracker,
  withImpressionTracker,
  composableImpressionTracker,
} from '.';
import 'intersection-observer';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import { act } from 'react-dom/test-utils';

jest.useFakeTimers();

const fakeUuid = () => {
  let i = 0;
  return () => {
    return 'uuid' + i++;
  };
};

interface Props {
  enable?: boolean;
  insertionId?: string;
  contentId?: string;
  text: string;
  logImpression: (impression: Impression) => void;
  handleError?: (err: Error) => void;
}

// So we can get the logImpressionFunctor
let latestLogImpressionFunctor: () => void = () => {
  /* no op */
};

// A simple component for testing useImpressionTracker.
const HookedExampleComponent = ({
  text,
  enable,
  insertionId,
  contentId,
  logImpression,
  handleError = (err) => {
    throw err;
  },
}: Props) => {
  const [ref, impressionId, logImpressionFunctor] = useImpressionTracker({
    enable,
    insertionId,
    contentId,
    handleError,
    logImpression,
    uuid: fakeUuid(),
  });
  if (impressionId === null) {
    throw Error('impressionId should not be null');
  }
  // TODO - add unit test that verifies that logImpressionFunctor won't call again.
  if (logImpressionFunctor === null) {
    throw Error('logImpressionFunctor should not be null');
  }
  latestLogImpressionFunctor = logImpressionFunctor;
  return <div ref={ref}>{text}</div>;
};

const runAllTimers = () =>
  act(() => {
    jest.runAllTimers();
  });

describe('useImpressionTracker', () => {
  it('set insertionId', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent text="component works" insertionId="uuid9" logImpression={logImpression} />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([
      [
        {
          impressionId: 'uuid0',
          insertionId: 'uuid9',
          sourceType: 1,
        },
      ],
    ]);
  });

  it('set contentId', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent text="component works" contentId="abc" logImpression={logImpression} />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([
      [
        {
          contentId: 'abc',
          impressionId: 'uuid0',
          sourceType: 1,
        },
      ],
    ]);
  });

  it('set insertionId and contentId', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([
      [
        {
          contentId: 'abc',
          impressionId: 'uuid0',
          insertionId: 'uuid9',
          sourceType: 1,
        },
      ],
    ]);
  });

  it('disabled', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent
        enable={false}
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([]);
  });

  it('make sure impression logs once', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    const impression1 = {
      contentId: 'abc',
      impressionId: 'uuid0',
      insertionId: 'uuid9',
      sourceType: 1,
    };
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    mockAllIsIntersecting(false);
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    runAllTimers();
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    runAllTimers();
    expect(logImpression.mock.calls).toEqual([[impression1]]);
  });

  it('call latestLogImpressionFunctor', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    const impression1 = {
      contentId: 'abc',
      impressionId: 'uuid0',
      insertionId: 'uuid9',
      sourceType: 1,
    };
    act(() => latestLogImpressionFunctor());
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([[impression1]]);
  });

  it('call latestLogImpressionFunctor after impression', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    const impression1 = {
      contentId: 'abc',
      impressionId: 'uuid0',
      insertionId: 'uuid9',
      sourceType: 1,
    };
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([[impression1]]);
    act(() => latestLogImpressionFunctor());
    expect(logImpression.mock.calls).toEqual([[impression1]]);
  });

  it('changing contentId should throw', () => {
    const logImpression = jest.fn();
    const { rerender } = render(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );

    expect(() => {
      rerender(
        <HookedExampleComponent
          text="component works"
          contentId="diff"
          insertionId="uuid9"
          logImpression={logImpression}
        />,
      );
    }).toThrow();
  });

  it('changing insertionId should not throw', () => {
    const logImpression = jest.fn();
    const { rerender } = render(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="uuid9"
        logImpression={logImpression}
      />,
    );

    rerender(
      <HookedExampleComponent
        text="component works"
        contentId="abc"
        insertionId="diff"
        logImpression={logImpression}
      />,
    );
  });

  it('no IDs - throw', () => {
    const logImpression = jest.fn();
    expect(() => render(<HookedExampleComponent text="component works" logImpression={logImpression} />));
  });

  it('no IDs - do nothing', () => {
    const logImpression = jest.fn();
    const { getByText } = render(
      <HookedExampleComponent text="component works" logImpression={logImpression} handleError={() => undefined} />,
    );
    expect(logImpression.mock.calls).toEqual([]);
    mockAllIsIntersecting(true);
    expect(logImpression.mock.calls).toEqual([]);
    runAllTimers();
    expect(getByText('component works')).toBeInTheDocument();
    expect(logImpression.mock.calls).toEqual([]);
  });

  interface WrappedProps extends WithImpressionTrackerProps {
    text: string;
  }

  // A simple component for testing useImpressionTracker.
  const WrappedExampleComponent = ({ impressionId, impressionRef, logImpressionFunctor, text }: WrappedProps) => {
    if (impressionId === null) {
      throw Error('impressionId should not be null');
    }
    if (logImpressionFunctor === null) {
      throw Error('logImpressionFunctor should not be null');
    }
    return <div ref={impressionRef}>{text}</div>;
  };

  describe('ImpressionTrackerHOC', () => {
    it('insertionId', () => {
      const logImpression = jest.fn();
      const InsertionIdTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
        logImpression,
        handleError: (err: Error) => {
          throw err;
        },
        getInsertionId: () => 'uuid9',
        uuid: fakeUuid(),
      });
      const { getByText } = render(<InsertionIdTrackedExampleComponent text="component works" />);
      expect(getByText('component works')).toBeInTheDocument();
      expect(logImpression.mock.calls).toEqual([]);
      mockAllIsIntersecting(true);
      expect(logImpression.mock.calls).toEqual([]);
      runAllTimers();
      expect(logImpression.mock.calls.length).toEqual(1);
      expect(logImpression.mock.calls[0].length).toEqual(2);
      expect(logImpression.mock.calls[0][0]).toEqual({
        impressionId: 'uuid0',
        insertionId: 'uuid9',
        sourceType: 1,
      });
      // This is the props.
      expect(logImpression.mock.calls[0][1].text).toEqual('component works');
    });

    it('contentId', () => {
      const logImpression = jest.fn();
      const ContentIdTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
        logImpression,
        handleError: (err: Error) => {
          throw err;
        },
        getContentId: () => 'abc',
        uuid: fakeUuid(),
      });
      const { getByText } = render(<ContentIdTrackedExampleComponent text="component works" />);
      expect(getByText('component works')).toBeInTheDocument();
      expect(logImpression.mock.calls).toEqual([]);
      mockAllIsIntersecting(true);
      expect(logImpression.mock.calls).toEqual([]);
      runAllTimers();
      expect(logImpression.mock.calls.length).toEqual(1);
      expect(logImpression.mock.calls[0].length).toEqual(2);
      expect(logImpression.mock.calls[0][0]).toEqual({
        impressionId: 'uuid0',
        contentId: 'abc',
        sourceType: 1,
      });
      // This is the props.
      expect(logImpression.mock.calls[0][1].text).toEqual('component works');
    });

    it('disabled', () => {
      const logImpression = jest.fn();
      const DisabledTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
        logImpression,
        handleError: (err: Error) => {
          throw err;
        },
        isEnabled: () => false,
        getInsertionId: () => '',
        uuid: fakeUuid(),
      });
      const { getByText } = render(<DisabledTrackedExampleComponent text="component works" />);
      expect(getByText('component works')).toBeInTheDocument();
      expect(logImpression.mock.calls).toEqual([]);
      mockAllIsIntersecting(true);
      expect(logImpression.mock.calls).toEqual([]);
      runAllTimers();
      expect(logImpression.mock.calls).toEqual([]);
    });

    it('no IDs - throws', () => {
      const logImpression = jest.fn();
      const NoIdsTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
        logImpression,
        handleError: (err: Error) => {
          throw err;
        },
        getInsertionId: () => '',
        getContentId: () => '',
        uuid: fakeUuid(),
      });
      expect(() => {
        // Sadly, this still outputs a console.error to the log before the exception is thrown.
        // There isn't a great way to fix this.
        render(<NoIdsTrackedExampleComponent text="component works" />);
      }).toThrow();
    });

    it('no IDs - do nothing', () => {
      const logImpression = jest.fn();
      const DisabledTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
        logImpression,
        handleError: () => {
          undefined;
        },
        isEnabled: () => false,
        getInsertionId: () => '',
        uuid: fakeUuid(),
      });
      const { getByText } = render(<DisabledTrackedExampleComponent text="component works" />);
      expect(getByText('component works')).toBeInTheDocument();
      expect(logImpression.mock.calls).toEqual([]);
      mockAllIsIntersecting(true);
      expect(logImpression.mock.calls).toEqual([]);
      runAllTimers();
      expect(logImpression.mock.calls).toEqual([]);
    });

    it('set defaultSourceType', () => {
      const logImpression = jest.fn();
      const InsertionIdTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
        getDefaultSourceType: () => 2,
        getInsertionId: () => 'uuid9',
        handleError: (err: Error) => {
          throw err;
        },
        logImpression,
        uuid: fakeUuid(),
      });
      const { getByText } = render(<InsertionIdTrackedExampleComponent text="component works" />);
      expect(getByText('component works')).toBeInTheDocument();
      expect(logImpression.mock.calls).toEqual([]);
      mockAllIsIntersecting(true);
      expect(logImpression.mock.calls).toEqual([]);
      runAllTimers();
      expect(logImpression.mock.calls.length).toEqual(1);
      expect(logImpression.mock.calls[0].length).toEqual(2);
      expect(logImpression.mock.calls[0][0]).toEqual({
        impressionId: 'uuid0',
        insertionId: 'uuid9',
        sourceType: 2,
      });
      // This is the props.
      expect(logImpression.mock.calls[0][1].text).toEqual('component works');
    });
  });

  describe('composeableImpressionTracker', () => {
    // We don't want to pull in a full version of compose since that's a large dev dependency to take.
    const compose = (fn: any) => fn;

    it('test', () => {
      const logImpression = jest.fn();
      const InsertionIdTrackedExampleComponent = compose(
        composableImpressionTracker({
          logImpression,
          handleError: (err: Error) => {
            throw err;
          },
          getInsertionId: () => 'uuid9',
          uuid: fakeUuid(),
        }),
      )(WrappedExampleComponent);
      const { getByText } = render(<InsertionIdTrackedExampleComponent text="component works" />);
      expect(getByText('component works')).toBeInTheDocument();
      expect(logImpression.mock.calls).toEqual([]);
      mockAllIsIntersecting(true);
      expect(logImpression.mock.calls).toEqual([]);
      runAllTimers();
      expect(logImpression.mock.calls.length).toEqual(1);
      expect(logImpression.mock.calls[0].length).toEqual(2);
      expect(logImpression.mock.calls[0][0]).toEqual({
        impressionId: 'uuid0',
        insertionId: 'uuid9',
        sourceType: 1,
      });
      // This is the props.
      expect(logImpression.mock.calls[0][1].text).toEqual('component works');
    });
  });
});
