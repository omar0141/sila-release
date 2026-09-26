/* Sila Web's push service worker.
 *
 * GLC Sila's backend pushes new messages over FCM with a `notification`
 * (title, body) and data naming the conversation (ChatType plus SessionID,
 * GroupID, TicketID, MailID or TaskID). With the tab in the background, the
 * notification is shown here; a click opens (or focuses) Sila on that
 * conversation. Keep it at the app root, and do not cache it. */

importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyBBCWQYJvRBKd31jJbhy88swH06zxwPyvw",
  appId: "1:97914066638:web:bb3e946f0053ff3924229f",
  messagingSenderId: "97914066638",
  projectId: "sila-c91b0",
  authDomain: "sila-c91b0.firebaseapp.com",
  storageBucket: "sila-c91b0.firebasestorage.app",
})

const messaging = firebase.messaging()
const appBase = new URL(self.registration.scope).pathname.replace(/\/$/, "")

/** Mirrors targetPath in src/shared/lib/routes.ts. */
function targetPath(data) {
  if (!data) return "/"
  const get = (key) => {
    const value = data[key]
    return value == null || value === "" || value === "0" ? null : String(value)
  }
  const type = get("ChatType")
  if ((type === "1" || !type) && get("SessionID")) return "/chats/" + get("SessionID")
  if ((type === "2" || !type) && get("GroupID")) return "/groups/" + get("GroupID")
  if ((type === "3" || !type) && get("TicketID")) return "/tickets/" + get("TicketID")
  if ((type === "4" || !type) && get("MailID")) return "/qmail/" + get("MailID")
  if ((type === "5" || type === "8" || !type) && get("TaskID")) return "/tasks/" + get("TaskID")
  if (type === "6") return "/?notifications=1"
  return "/"
}

/** One notification per conversation: a newer message replaces the older. */
function conversationTag(data) {
  const path = targetPath(data)
  return path === "/" ? undefined : "sila" + path.replace(/\//g, "-")
}

// Data-only pushes: show them ourselves. (With a `notification` block the
// SDK already shows it, so don't show a second one.)
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return
  const data = payload.data || {}
  const title = data.title || data.Title || "GLC Sila"
  return self.registration.showNotification(title, {
    body: data.body || data.Text || "",
    icon: `${appBase}/icons/Icon-192.png`,
    badge: `${appBase}/icons/Icon-192.png`,
    tag: conversationTag(data),
    renotify: true,
    data: { ...data, url: targetPath(data) },
  })
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const own = event.notification.data || {}
  // Notifications the SDK showed keep the push under FCM_MSG.
  const fcm = own.FCM_MSG || {}
  const url = own.url || targetPath(fcm.data || own)
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true })
      const sila = windows.find((w) => new URL(w.url).origin === self.location.origin && new URL(w.url).pathname.startsWith(`${appBase}/`))
      if (sila) {
        await sila.focus()
        sila.postMessage({ type: "sila-open", url })
        return
      }
      await clients.openWindow(`${appBase}${url}`)
    })(),
  )
})

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))
