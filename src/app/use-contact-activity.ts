import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { getApiErrorMessage } from "@/lib/api/error-schema";

const activityItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    "CONTACT_CREATED",
    "CONTACT_UPDATED",
    "TAG_ADDED",
    "TAG_REMOVED",
  ]),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});
const activityResponseSchema = z.object({
  items: z.array(activityItemSchema),
});

export type ActivityItem = z.infer<typeof activityItemSchema>;

type Options = {
  open: boolean;
  contactId: string | undefined;
  onError: (message: string) => void;
};

export function useContactActivity({ open, contactId, onError }: Options) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(Boolean(open && contactId));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const beginLoading = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const retry = useCallback(() => {
    beginLoading();
    setRefreshKey((key) => key + 1);
  }, [beginLoading]);

  useEffect(() => {
    if (!open || !contactId) return;
    const controller = new AbortController();

    async function loadActivity() {
      try {
        const response = await fetch(`/api/contacts/${contactId}/activity`, {
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload, "Could not load activity."),
          );
        }
        const parsed = activityResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("The activity service returned invalid data.");
        }
        setActivity(parsed.data.items);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Could not load activity.";
        setError(message);
        onError(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadActivity();
    return () => controller.abort();
  }, [contactId, onError, open, refreshKey]);

  return { activity, loading, error, beginLoading, retry };
}
