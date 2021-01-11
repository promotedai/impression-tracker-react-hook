import React from 'react';
import { render } from '@testing-library/react';
import { useImpressionTracker } from '.';
import 'intersection-observer';

interface Props {
  text: string;
}

export const ExampleComponent = ({ text }: Props) => {
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
    const { getByText } = render(<ExampleComponent text="component works" />);
    expect(getByText('component works')).toBeInTheDocument();
  });
});
