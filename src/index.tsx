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

export interface Impression {
  insertionId?: string;
  contentId?: string;
  impressionId: string;
}

interface TrackerArguments {
  /* A quick way to disable the hook. Defaults to true.*/
  enable?: boolean;
  /* The (pre-impression) insertionId to log on the impressionId. Defauls to undefined. */
  insertionId?: string;
  /* The contentId to log on the impressionId. Defaults to undefined. */
  contentId?: string;
  /* Called when we should log an impression. */
  logImpression: (impression: Impression) => void;
  /* Called when an error occurs. */
  handleError: (err: Error) => void;
  /* To override the visibility threshold. Defaults to 50% visible. */
  intersectionOptions?: IntersectionOptions;
  /* A way to override for testing. Defaults to uuidv4. */
  uuid?: () => string;
  /* To override the visibility threshold. Defaults to 1s. */
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
    enable = true,
    insertionId = '',
    contentId = '',
    logImpression,
    handleError,
    intersectionOptions = {
      threshold: DEFAULT_VISIBILITY_RATIO_THRESHOLD,
    },
    uuid = uuidv4,
    visibilityTimeThreshold = DEFAULT_VISIBILITY_TIME_THRESHOLD,
  } = args;
  if (enable) {
    if ((insertionId === '' || insertionId === undefined) && (contentId === '' || contentId === undefined)) {
      handleError(new Error('insertionId or contentId should be set'));
    } else if (typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined') {
      try {
        const [ref, inView] = useInView(intersectionOptions);
        const [currentInsertionId, setInsertionId] = useState('');
        const [currentContentId, setContentId] = useState('');
        const [currentImpressionId, setImpressionId] = useState('');
        const [logged, setLogged] = useState(false);

        const _setIds = () => {
          // This React hook is designed to be used with only one Insertion.
          if (currentInsertionId !== undefined && currentInsertionId !== '' && insertionId !== currentInsertionId) {
            handleError(
              new Error(
                `The same useImpressionTracker should not be used with multiple insertions. currentInsertionId=${currentInsertionId}, insertionId=${insertionId}, currentInsertionId=${currentInsertionId}`
              )
            );
          }
          if (currentContentId !== undefined && currentContentId !== '' && contentId !== currentContentId) {
            handleError(
              new Error(
                `The same useImpressionTracker should not be used with multiple contents. currentContentId=${currentContentId}, contentId=${contentId}, currentContentId=${currentContentId}`
              )
            );
          }
          setInsertionId(insertionId);
          setContentId(contentId);
          // When insertionId changes, change the impressionId.  This is in case
          // the client has bugs.
          const impressionId = uuid();
          setImpressionId(impressionId);
          return impressionId;
        };

        // Generate a new UUID on mount.
        useEffect(() => {
          _setIds();
        }, [insertionId, contentId]);

        const logImpressionFunctor = () => {
          if (!logged) {
            setLogged(true);
            // In case there is a weird corner case where impressionId has not been set.
            let impressionId = currentImpressionId;
            if (impressionId === '') {
              impressionId = _setIds();
            }
            const impression: Impression = {
              impressionId,
            };
            if (insertionId) {
              impression.insertionId = insertionId;
            }
            if (contentId) {
              impression.contentId = contentId;
            }
            logImpression(impression);
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

        return [ref, currentImpressionId, logImpressionFunctor];
      } catch (error) {
        handleError(error);
      }
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

export interface HocTrackerArguments<P extends WithImpressionTrackerProps> {
  /* A quick way to disable the hook. Defaults to true. */
  isEnabled?: (props: Subtract<P, WithImpressionTrackerProps>) => boolean;
  /* Get the insertion ID from the props. Defaults to empty string. */
  getInsertionId?: (props: Subtract<P, WithImpressionTrackerProps>) => string;
  /* Get the content ID from the props. defaults to empty string. */
  getContentId?: (props: Subtract<P, WithImpressionTrackerProps>) => string;
  /* Called when we should log an impression. */
  logImpression: (impression: Impression) => void;
  /* Called when an error occurs. */
  handleError: (err: Error) => void;
  /* To override the visibility threshold. Defaults to 50% visible. */
  intersectionOptions?: IntersectionOptions;
  /* A way to override for testing. Defaults to uuidv4. */
  uuid?: () => string;
  /* To override the visibility threshold. Defaults to 1s.*/
  visibilityTimeThreshold?: number;
}

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
 * @param handleError     what to do with errors
 */
export const withImpressionTracker = <P extends WithImpressionTrackerProps>(
  Component: React.ComponentType<P>,
  args: HocTrackerArguments<P>
): React.FC<Subtract<P, WithImpressionTrackerProps>> => {
  const fn = (props: Subtract<P, WithImpressionTrackerProps>) => {
    const {
      isEnabled,
      getInsertionId,
      getContentId,
      logImpression,
      handleError,
      intersectionOptions,
      uuid,
      visibilityTimeThreshold,
    } = args;
    let enable = isEnabled === undefined ? true : isEnabled(props);
    if (enable == undefined) {
      enable = true;
    }
    const hookArgs: TrackerArguments = {
      enable,
      insertionId: enable && getInsertionId ? getInsertionId(props) : '',
      contentId: enable && getContentId ? getContentId(props) : '',
      logImpression,
      handleError,
      intersectionOptions,
      uuid,
      visibilityTimeThreshold,
    };
    const [impressionRef, impressionId, logImpressionFunctor] = useImpressionTracker(hookArgs);
    return (
      <Component
        {...(props as P)}
        impressionRef={impressionRef}
        impressionId={impressionId}
        logImpressionFunctor={logImpressionFunctor}
      />
    );
  };
  fn.displayName = 'WithImpressionTracker';
  return fn;
};
