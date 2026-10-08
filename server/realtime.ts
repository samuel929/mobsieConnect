export type RealtimeTopic = "messages" | "calendar" | "daily_activity" | "newsletter";

export type RealtimeEvent = {
  topic: RealtimeTopic;
  tenantId: string;
  parentAccountId?: string | null;
  occurredAt: string;
};

type Subscriber = {
  tenantId: string;
  parentAccountId: string;
  send: (payload: string) => void;
};

declare global {
  var __mobsieRealtimeSubscribers: Set<Subscriber> | undefined;
}

const subscribers = () =>
  (global.__mobsieRealtimeSubscribers ??= new Set<Subscriber>());

export function subscribeRealtime(subscriber: Subscriber) {
  subscribers().add(subscriber);
  return () => subscribers().delete(subscriber);
}

export function publishRealtime(
  topic: RealtimeTopic,
  tenantId: string,
  parentAccountId?: string | null,
) {
  const event: RealtimeEvent = {
    topic,
    tenantId,
    parentAccountId,
    occurredAt: new Date().toISOString(),
  };
  const payload = JSON.stringify(event);
  for (const subscriber of subscribers()) {
    if (subscriber.tenantId !== tenantId) continue;
    if (parentAccountId && subscriber.parentAccountId !== parentAccountId) continue;
    try {
      subscriber.send(payload);
    } catch {
      subscribers().delete(subscriber);
    }
  }
}
