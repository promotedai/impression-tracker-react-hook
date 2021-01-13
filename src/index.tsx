import { Subtract } from 'utility-types';
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import 'intersection-observer';
import { IntersectionOptions, useInView } from 'react-intersection-observer';
// TODO - switch to dynamic import approach.

// TODO - support polyfill.
// https://www.npmjs.com/package/react-intersection-observer#polyfill

// Simple logic for now.  A piece of content must have been continuously viewed
// for the visibilityTimeThreshold.
const DEFAULT_VISIBILITY_RATIO_THRESHOLD = 0.5;
const DEFAULT_VISIBILITY_TIME_THRESHOLD = 1000;

interface TrackerProps {
  /* The (pre-impression) insertionId to log on the impressionId. */
  insertionId: string;
  /* Called when we should log an impression. */
  logImpression: (impressionId: string) => void;
  /* Called when an error occurs. */
  handleLogError: (err: Error) => void;
  /* To override the visibility threshold. */
  intersectionOptions?: IntersectionOptions;
  /* To override the visibility threshold. */
  visibilityTimeThreshold?: number;
}

type TrackerResponse = [(node?: Element | null) => void, string, () => void];

/*
Calls `logImpression` if a insertion `ref` is viewed log enough to be considered
an impression.


This is important because we want more signals into content interaction.

This hook returns [ref, impressionId, logImpression].  The ref needs to be
attached to the element we want to track.  On mount, we generate an
impressionId, even if we do not log an impression.  We want the impressionId
ready in case an item is clicked on without fully qualifying for an impression.

Uses the `react-intersection-observer` to keep track of visibility changes.
This won't work with older browsers.
*/
export const useImpressionTracker = (props: TrackerProps): TrackerResponse => {
  const {
    insertionId,
    logImpression,
    handleLogError,
    intersectionOptions = {
      threshold: DEFAULT_VISIBILITY_RATIO_THRESHOLD,
    },
    visibilityTimeThreshold = DEFAULT_VISIBILITY_TIME_THRESHOLD,
  } = props;
  if (typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined') {
    try {
      const [ref, inView] = useInView(intersectionOptions);
      const [prevInsertionId, setInsertionId] = useState('');
      const [impressionId, setImpressionId] = useState('');
      const [logged, setLogged] = useState(false);

      // Generate a new UUID on mount.
      useEffect(() => {
        // This React hook is designed to be used with only one Insertion.
        if (prevInsertionId !== '' && insertionId !== prevInsertionId) {
          handleLogError(new Error('The same useImpressionTracker should not be used with multiple insertions'));
        }
        setInsertionId(insertionId);
        // Only generate an impressionId if not set.
        if (impressionId === '') {
          setImpressionId(uuidv4());
        }
      }, [insertionId]);

      const _logImpression = () => {
        if (!logged) {
          setLogged(true);
          // In case there is a weird corner case where impressionId has not been set.
          if (impressionId === '') {
            setImpressionId(uuidv4());
          }
          logImpression(impressionId);
        }
      };

      useEffect(
        () => {
          if (!inView || logged) {
            return;
          }
          const timer = setTimeout(_logImpression, visibilityTimeThreshold);
          return () => clearTimeout(timer);
        },
        // TODO - should ref.current be in this?
        // The Typescript interface for the useInView hook is limited.
        // @ts-expect-error ref.current is not in the type.
        [ref.current, inView]
      );

      return [ref, impressionId, _logImpression];
    } catch (error) {
      handleLogError(error);
    }
  }
  return [
    () => {
      /* do nothing */
    },
    '',
    () => {
      /* do nothing */
    },
  ];
};

export interface WithImpressionTrackerProps {
  impressionRef: (node?: Element | null) => void;
  impressionId: string;
  logImpression: () => void;
}

/**
 * An HOC version of useImpressionProps.  If you can, use the hook instead.
 * @param Component          the Component to wrap
 * @param getInsertionId     gets the insertionId from the props
 * @param innerLogImpression your logging code
 * @param handleLogError     what to do with errors
 */
export const withImpressionTracker = <P extends WithImpressionTrackerProps>(
  Component: React.ComponentType<P>,
  getInsertionId: (props: Subtract<P, WithImpressionTrackerProps>) => string,
  innerLogImpression: (impressionId: string) => void,
  handleLogError: (err: Error) => void
): React.FC<Subtract<P, WithImpressionTrackerProps>> => (props: Subtract<P, WithImpressionTrackerProps>) => {
  const [impressionRef, impressionId, logImpression] = useImpressionTracker({
    insertionId: getInsertionId(props),
    logImpression: innerLogImpression,
    handleLogError,
  });
  return (
    <Component
      {...(props as P)}
      impressionRef={impressionRef}
      impressionId={impressionId}
      logImpression={logImpression}
    />
  );
};
