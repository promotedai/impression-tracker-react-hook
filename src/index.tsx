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

export interface CommonImpression {
  insertionId: string;
  impressionId: string;
}

export interface Impression {
  common: CommonImpression;
}

interface TrackerArguments {
  /* The (pre-impression) insertionId to log on the impressionId. */
  insertionId: string;
  /* Called when we should log an impression. */
  logImpression: (impression: Impression) => void;
  /* Called when an error occurs. */
  handleLogError: (err: Error) => void;
  /* To override the visibility threshold. */
  intersectionOptions?: IntersectionOptions;
  /* To override the visibility threshold. */
  visibilityTimeThreshold?: number;
}

type TrackerResponse = [(node?: Element | null) => void, string, () => void];

/**
 * Calls `logImpression` if a insertion `ref` is viewed log enough to be
 * considered an impression.
 *
 * This is important because we want more signals into content interaction.
 *
 * This hook returns [ref, impressionId, logImpressionFunctor].  The ref needs
 * to be attached to the element we want to track.  On mount, we generate an
 * impressionId, even if we do not log an impression.  We want the impressionId
 * ready in case an item is clicked on without fully qualifying for an impression.
 *
 * Uses the `react-intersection-observer` to keep track of visibility changes.
 * This won't work with older browsers.
 *
 * @param props arguments
 * @return [ref, impressionId, logImpressionFunctor] - functor is a no arg
 *         function that can be used for convenience.
 */
export const useImpressionTracker = (args: TrackerArguments): TrackerResponse => {
  const {
    insertionId,
    logImpression,
    handleLogError,
    intersectionOptions = {
      threshold: DEFAULT_VISIBILITY_RATIO_THRESHOLD,
    },
    visibilityTimeThreshold = DEFAULT_VISIBILITY_TIME_THRESHOLD,
  } = args;
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

      const logImpressionFunctor = () => {
        if (!logged) {
          setLogged(true);
          // In case there is a weird corner case where impressionId has not been set.
          if (impressionId === '') {
            setImpressionId(uuidv4());
          }
          logImpression({
            common: {
              impressionId,
              insertionId,
            },
          });
        }
      };

      useEffect(
        () => {
          if (!inView || logged) {
            return;
          }
          const timer = setTimeout(logImpressionFunctor, visibilityTimeThreshold);
          return () => clearTimeout(timer);
        },
        // TODO - should ref.current be in this?
        // The Typescript interface for the useInView hook is limited.
        // @ts-expect-error ref.current is not in the type.
        [ref.current, inView]
      );

      return [ref, impressionId, logImpressionFunctor];
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
  logImpressionFunctor: () => void;
}

/**
 * An HOC version of useImpressionProps.  If you can, use the hook instead.
 *
 * @param Component          the Component to wrap
 * @param getInsertionId     gets the insertionId from the props
 * @param innerLogImpression your logging code
 * @param handleLogError     what to do with errors
 */
export const withImpressionTracker = <P extends WithImpressionTrackerProps>(
  Component: React.ComponentType<P>,
  getInsertionId: (props: Subtract<P, WithImpressionTrackerProps>) => string,
  logImpression: (impression: Impression) => void,
  handleLogError: (err: Error) => void
): React.FC<Subtract<P, WithImpressionTrackerProps>> => (props: Subtract<P, WithImpressionTrackerProps>) => {
  const insertionId = getInsertionId(props);
  const [impressionRef, impressionId, logImpressionFunctor] = useImpressionTracker({
    insertionId,
    logImpression,
    handleLogError,
  });
  return (
    <Component
      {...(props as P)}
      impressionRef={impressionRef}
      impressionId={impressionId}
      logImpressionFunctor={logImpressionFunctor}
    />
  );
};