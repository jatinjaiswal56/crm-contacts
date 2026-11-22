import { useCallback, useState } from "react";

type QueryDraft = {
  /** URL value the draft was typed against. */
  queryValue: string;
  value: string;
  /** Last value this component pushed to the URL and is waiting to land. */
  pushedValue: string | null;
};

/**
 * Local input state that follows the URL. The draft wins while the URL is
 * unchanged or is catching up to a value we pushed (so characters typed
 * during the router update are kept); any other URL change (back/forward,
 * links) replaces the draft.
 */
export function useQueryDraft(queryValue: string) {
  const [draft, setDraft] = useState<QueryDraft>({
    queryValue,
    value: queryValue,
    pushedValue: null,
  });

  const urlCaughtUp =
    draft.queryValue !== queryValue && draft.pushedValue === queryValue;
  if (urlCaughtUp) {
    setDraft({ queryValue, value: draft.value, pushedValue: null });
  }
  const value =
    draft.queryValue === queryValue || urlCaughtUp ? draft.value : queryValue;

  const setValue = useCallback(
    (nextValue: string) =>
      setDraft((current) => ({
        queryValue,
        value: nextValue,
        pushedValue:
          current.queryValue === queryValue ? current.pushedValue : null,
      })),
    [queryValue],
  );
  const markPushed = useCallback(
    (pushedValue: string) =>
      setDraft((current) => ({ ...current, pushedValue })),
    [],
  );

  return [value, setValue, markPushed] as const;
}
