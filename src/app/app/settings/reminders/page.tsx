import { redirect } from "next/navigation";

// Reminders became Settings → Notifications (every kind, each on or off).
export default function RemindersSettingsPage() {
  redirect("/app/settings/notifications");
}
