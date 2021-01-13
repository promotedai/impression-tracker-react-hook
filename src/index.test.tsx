import React from 'react';
import { render } from '@testing-library/react';
import { WithImpressionTrackerProps, useImpressionTracker, withImpressionTracker } from '.';
import 'intersection-observer';

interface Props {
  text: string;
}

// A simple component for testing useImpressionTracker.
export const HookedExampleComponent = ({ text }: Props) => {
  const [ref, impressionId, logImpression] = useImpressionTracker({
    insertionId: 'abc',
    logImpression: (impressionId) => console.error(impressionId),
    handleLogError: (err) => {
      throw err;
    },
  });
  if (impressionId === null) {
    throw Error('impressionId should not be null');
  }
  if (logImpression === null) {
    throw Error('logImpression should not be null');
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
export const WrappedExampleComponent = ({ impressionId, impressionRef, logImpression, text }: WrappedProps) => {
  if (impressionId === null) {
    throw Error('impressionId should not be null');
  }
  if (logImpression === null) {
    throw Error('logImpression should not be null');
  }
  return <div ref={impressionRef}>{text}</div>;
};

const TrackedExampleComponent = withImpressionTracker(
  WrappedExampleComponent,
  () => 'test-insertion',
  () => null,
  (err) => {
    throw err;
  }
);

describe('useImpressionTracker', () => {
  it('just make sure simple render works', () => {
    const { getByText } = render(<TrackedExampleComponent text="component works" />);
    expect(getByText('component works')).toBeInTheDocument();
  });
  // TODO - add tests for interactions.
});
