import React from 'react';
import { render } from '@testing-library/react';
import { WithImpressionTrackerProps, useImpressionTracker, withImpressionTracker } from '.';
import 'intersection-observer';

interface Props {
  text: string;
}

// A simple component for testing useImpressionTracker.
export const HookedExampleComponent = ({ text }: Props) => {
  const [ref, impressionId, logImpressionFunctor] = useImpressionTracker({
    insertionId: 'abc',
    logImpression: (impression) => {
      // Not tested.
      throw JSON.stringify(impression);
    },
    handleLogError: (err) => {
      throw err;
    },
  });
  if (impressionId === null) {
    throw Error('impressionId should not be null');
  }
  if (logImpressionFunctor === null) {
    throw Error('logImpressionFunctor should not be null');
  }
  return <div ref={ref}>{text}</div>;
};

describe('useImpressionTracker', () => {
  it('just make sure simple render works', () => {
    const { getByText } = render(<HookedExampleComponent text="component works" />);
    expect(getByText('component works')).toBeInTheDocument();
  });
  // TODO - add tests for interactions.
});

interface WrappedProps extends WithImpressionTrackerProps {
  text: string;
}

// A simple component for testing useImpressionTracker.
export const WrappedExampleComponent = ({ impressionId, impressionRef, logImpressionFunctor, text }: WrappedProps) => {
  if (impressionId === null) {
    throw Error('impressionId should not be null');
  }
  if (logImpressionFunctor === null) {
    throw Error('logImpressionFunctor should not be null');
  }
  return <div ref={impressionRef}>{text}</div>;
};

describe('ImpressionTrackerHOC', () => {
  const TrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
    getInsertionId: () => 'test-insertion',
    logImpression: () => null,
    handleLogError: (err) => {
      throw err;
    },
  });

  it('just make sure simple render works', () => {
    const { getByText } = render(<TrackedExampleComponent text="component works" />);
    expect(getByText('component works')).toBeInTheDocument();
  });

  const DisabledTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
    isEnabled: () => false,
    getInsertionId: () => '',
    logImpression: () => null,
    handleLogError: (err) => {
      throw err;
    },
  });

  it('disabled', () => {
    const { getByText } = render(<DisabledTrackedExampleComponent text="component works" />);
    expect(getByText('component works')).toBeInTheDocument();
  });

  const NoInsertionTrackedExampleComponent = withImpressionTracker(WrappedExampleComponent, {
    getInsertionId: () => '',
    logImpression: () => null,
    handleLogError: (err) => {
      throw err;
    },
  });

  it('no insertionId throws', () => {
    expect(() => render(<NoInsertionTrackedExampleComponent text="component works" />)).toThrow();
  });
});
