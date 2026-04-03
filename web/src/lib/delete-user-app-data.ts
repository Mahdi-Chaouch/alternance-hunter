import type { User } from "better-auth/types";
import { deleteUserProfileRow } from "@/lib/user-profile";
import { deleteRunEventsForOwner } from "@/lib/run-events";
import { deleteUploadEventsForUser } from "@/lib/quotas";
import { deleteRateLimitRowsForUser } from "@/lib/rate-limit";
import { removeInvitedEmail } from "@/lib/invited-emails";

/**
 * Deletes app-owned PostgreSQL rows for this user before Better Auth removes the auth user.
 */
export async function deleteUserAppData(user: User): Promise<void> {
  const userId = user.id?.trim();
  if (!userId) return;

  await Promise.all([
    deleteUserProfileRow(userId),
    deleteRunEventsForOwner(userId),
    deleteUploadEventsForUser(userId),
    deleteRateLimitRowsForUser(userId),
  ]);

  const email = user.email?.trim().toLowerCase();
  if (email) {
    await removeInvitedEmail(email);
  }
}
