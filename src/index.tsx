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
    insertionId: propInsertionId = '',
    contentId: propContentId = '',
    logImpression,
    handleError,
    intersectionOptions = {
      threshold: DEFAULT_VISIBILITY_RATIO_THRESHOLD,
    },
    uuid = uuidv4,
    visibilityTimeThreshold = DEFAULT_VISIBILITY_TIME_THRESHOLD,
  } = args;

  // active combines enabled and valid params.
  let active = enable;
  if (active && !propInsertionId && !propContentId) {
    handleError(new Error('insertionId or contentId should be set'));
    active = false;
  }
  // If IntersectionObserver is not present, mark as not active.
  if (active && !(typeof window !== 'undefined' && typeof (window as any).IntersectionObserver !== 'undefined')) {
    active = false;
  }

  const [logged, setLogged] = useState(false);
  const [, setInsertionId, insertionIdRef] = useStateRef('');
  const [, setContentId, contentIdRef] = useStateRef('');
  const [, setImpressionId, impressionIdRef] = useStateRef('');
  const [ref, inView] = useInView({
    ...intersectionOptions,
    skip: !enable,
  });

  // TODO - figure out if prop changes can cause the setup to break.

  const setIds = () => {
    if (!active) {
      return '';
    }
    if (contentIdRef.current && propContentId !== contentIdRef.current) {
      handleError(new Error(`Unexpected contentId change from ${contentIdRef.current} to ${propContentId}`));
    }
    let impressionId = impressionIdRef.current;
    // If the insertionId changes, regenerate the impressionId.
    if (!impressionId || insertionIdRef.current != propInsertionId) {
      impressionId = uuid();
    }
    setInsertionId(propInsertionId);
    setContentId(propContentId);
    setImpressionId(impressionId);
    return impressionId;
  };

  const logImpressionFunctor = () => {
    if (!active || logged) {
      return;
    }
    setLogged(true);
    // In case there is a weird corner case where impressionId has not been set.
    let currentImpressionId = impressionIdRef.current;
    if (currentImpressionId === '') {
      currentImpressionId = setIds();
    }
    const impression: Impression = {
      impressionId: currentImpressionId,
    };
    if (insertionIdRef.current) {
      impression.insertionId = insertionIdRef.current;
    }
    if (contentIdRef.current) {
      impression.contentId = contentIdRef.current;
    }
    logImpression(impression);
  };

  // Generate a new UUID on mount.
  useEffect(() => {
    setIds();
  }, [propInsertionId, propContentId]);

  useEffect(
    () => {
      if (active && !logged && inView) {
        const timer = setTimeout(logImpressionFunctor, visibilityTimeThreshold);
        return () => clearTimeout(timer);
      } else {
        return;
      }
    },
    // TODO - should ref.current be in this?
    // The Typescript interface for the useInView hook is limited.
    [(ref as any).current, inView]
  );

  return [ref, impressionIdRef.current, logImpressionFunctor];
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

type CurrentRef<T> = {
  current: T;
};

type StateRefResponse<T> = [T, (value: T) => void, CurrentRef<T>];

// Forked from https://github.com/Aminadav/react-useStateRef/blob/master/index.js
function useStateRef<T>(defaultValue: T): StateRefResponse<T> {
  const [state, setState] = React.useState(defaultValue);
  const ref = React.useRef(state);

  const dispatch = React.useCallback(function (val) {
    ref.current = typeof val === 'function' ? val(ref.current) : val;

    setState(ref.current);
  }, []);

  return [state, dispatch, ref];
}
