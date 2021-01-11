import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import 'intersection-observer';
import { useInView } from 'react-intersection-observer';
// TODO - switch to dynamic import approach.

// Simple logic for now.  A piece of content must have been continuously viewed
// for the visibilityTimeThreshold.
const DEFAULT_VISIBILITY_RATIO_THRESHOLD = 0.5;
const DEFAULT_VISIBILITY_TIME_THRESHOLD = 1000;

interface TrackerProps {
  insertionId: string;
  logImpression: (impressionId: string) => void;
  handleLogError: (err: Error) => void;
  visibleRatioThreshold?: number;
  visibilityTimeThreshold?: number;
}

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
export const useImpressionTracker = (props: TrackerProps) => {
  const {
    insertionId,
    logImpression,
    handleLogError,
    visibleRatioThreshold = DEFAULT_VISIBILITY_RATIO_THRESHOLD,
    visibilityTimeThreshold = DEFAULT_VISIBILITY_TIME_THRESHOLD,
  } = props;
  try {
    const [ref, inView] = useInView({
      threshold: visibleRatioThreshold,
    });
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
    return [
      () => {
        /* do nothing */
      },
      '',
      () => {
        /* do nothing */
      },
    ];
  }
};
