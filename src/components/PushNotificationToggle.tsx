import { useState, useEffect } from "react";
import {
  getVapidPublicKey,
  getCurrentSubscription,
  subscribeToPush,
  saveSubscription,
  removeSubscription,
} from "@/lib/push-client";

type State = "loading" | "unsupported" | "unconfigured" | "denied" | "subscribed" | "unsubscribed";

export function PushNotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [working, setWorking] = useState(false);
  const [sub, setSub] = useState<PushSubscription | null>(null);

  useEffect(() => {
    async function init() {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setState("unsupported");
        return;
      }

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        setState("unconfigured");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      const existing = await getCurrentSubscription();
      setSub(existing);
      setState(existing ? "subscribed" : "unsubscribed");
    }
    init();
  }, []);

  async function enable() {
    setWorking(true);
    try {
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) { setState("unconfigured"); return; }

      const permission = await Notification.requestPermission();
      if (permission === "denied") { setState("denied"); return; }
      if (permission !== "granted") return;

      const newSub = await subscribeToPush(vapidKey);
      await saveSubscription(newSub);
      setSub(newSub);
      setState("subscribed");
    } catch {
      // browser blocked or subscription failed — leave state as-is
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    if (!sub) return;
    setWorking(true);
    try {
      await removeSubscription(sub);
      setSub(null);
      setState("unsubscribed");
    } catch {
      // ignore
    } finally {
      setWorking(false);
    }
  }

  if (state === "loading" || state === "unsupported" || state === "unconfigured") return null;

  const isOn = state === "subscribed";

  return (
    <label className="mt-4 flex cursor-pointer items-start gap-3">
      <span className="mt-0.5 shrink-0">
        <button
          role="switch"
          aria-checked={isOn}
          onClick={isOn ? disable : enable}
          disabled={working || state === "denied"}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
            isOn ? "bg-navy" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              isOn ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink">Browser notifications</span>
        {state === "denied" ? (
          <span className="block text-sm text-red-500">
            Notifications blocked — reset permissions in your browser settings to enable.
          </span>
        ) : (
          <span className="block text-sm text-ink-soft">
            Get notified about new content even when you&apos;re not on the site.
          </span>
        )}
      </span>
    </label>
  );
}
