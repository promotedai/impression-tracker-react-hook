import { Subtract } from 'utility-types';
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import 'intersection-observer';
import { IntersectionOptions, useInView } from 'react-intersection-observer';
import { useStateRef } from './useStateRef';

// TODO - switch to dynamic import approach.
// TODO - support polyfill.
// https://www.npmjs.com/package/react-intersection-observer#polyfill

// Simple logic for now.  A piece of content must have been continuously viewed
// for the visibilityTimeThreshold.
const DEFAULT_VISIBILITY_RATIO_THRESHOLD = 0.5;
const DEFAULT_VISIBILITY_TIME_THRESHOLD = 1000;

export interface ImpressionSourceTypeMap {
  UNKNOWN_IMPRESSION_SOURCE_TYPE: 0;
  DELIVERY: 1;
  CLIENT_BACKEND: 2;
}

export type ImpressionSourceTypeString = 'UNKNOWN_IMPRESSION_SOURCE_TYPE' | 'DELIVERY' | 'CLIENT_BACKEND';

export interface Impression {
  userInfo?: {
    anonUserId?: string;
    userId?: string;
    isInternalUser?: boolean;
  };
  insertionId?: string;
  contentId?: string;
  impressionId: string;
  sourceType?: ImpressionSourceTypeMap[keyof ImpressionSourceTypeMap] | ImpressionSourceTypeString;
  properties?: {
    struct: any;
  };
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
  /* Used to set the default source type.  Defaults to 'DELIVERY' = 1. */
  defaultSourceType?: ImpressionSourceTypeMap[keyof ImpressionSourceTypeMap] | ImpressionSourceTypeString;
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
    contentId: propContentId = '',
    // 'DELIVERY'.
    defaultSourceType = 1,
    enable = true,
    handleError,
    insertionId: propInsertionId = '',
    intersectionOptions = {
      threshold: DEFAULT_VISIBILITY_RATIO_THRESHOLD,
    },
    logImpression,
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
    skip: !active,
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
      sourceType: defaultSourceType,
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
    [(ref as any).current, inView],
  );

  return [ref, impressionIdRef.current, logImpressionFunctor];
};

export interface HocTrackerArguments<P extends WithImpressionTrackerProps> {
  /* A quick way to disable the hook. Defaults to true. */
  isEnabled?: (props: Subtract<P, WithImpressionTrackerProps>) => boolean;
  /* Used to set the default source type.  Defaults to 'DELIVERY' = 1. */
  getDefaultSourceType?: (
    props: Subtract<P, WithImpressionTrackerProps>,
  ) => ImpressionSourceTypeMap[keyof ImpressionSourceTypeMap] | ImpressionSourceTypeString;
  /* Get the insertion ID from the props. Defaults to empty string. */
  getInsertionId?: (props: Subtract<P, WithImpressionTrackerProps>) => string;
  /* Get the content ID from the props. defaults to empty string. */
  getContentId?: (props: Subtract<P, WithImpressionTrackerProps>) => string;
  /* The method for logging an impression event.  Usually this calls `promoted-snowplow-logger`.
     This is called between this library identifying an impression and when the API is called.
     Clients can modify impressions in this call.  An optional props is returned so
     the impression record can be modified using props. */
  logImpression: (impression: Impression, props?: Subtract<P, WithImpressionTrackerProps>) => void;
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
 * @param Component the Component to wrap
 * @param args      gets the insertionId from the props
 * @returns a wrapped Component that supports impression tracking
 */
export const withImpressionTracker = <P extends WithImpressionTrackerProps>(
  Component: React.ComponentType<P>,
  args: HocTrackerArguments<P>,
): React.FC<Subtract<P, WithImpressionTrackerProps>> => {
  const fn = (props: Subtract<P, WithImpressionTrackerProps>) => {
    const {
      isEnabled,
      getDefaultSourceType,
      getInsertionId,
      getContentId,
      logImpression: logImpressionWithProps,
      handleError,
      intersectionOptions,
      uuid,
      visibilityTimeThreshold,
    } = args;
    const enable = (isEnabled !== undefined ? isEnabled(props) : true) ?? true;
    const hookArgs: TrackerArguments = {
      enable,
      defaultSourceType: enable && getDefaultSourceType ? getDefaultSourceType(props) : 1,
      insertionId: enable && getInsertionId ? getInsertionId(props) : '',
      contentId: enable && getContentId ? getContentId(props) : '',
      logImpression: (impression) => logImpressionWithProps(impression, props),
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

/**
 * An HOC version of useImpressionProps that works with `compose`.  If you can, use the hook instead.
 *
 * @param args      gets the insertionId from the props
 * @returns a `Function<Component, Component>` that works with `compose`
 */
export const composableImpressionTracker = <P extends WithImpressionTrackerProps>(
  args: HocTrackerArguments<P>,
): ((Component: React.ComponentType<P>) => React.FC<Subtract<P, WithImpressionTrackerProps>>) => {
  return (Component: React.ComponentType<P>) => withImpressionTracker(Component, args);
};
