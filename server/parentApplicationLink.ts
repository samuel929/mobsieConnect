import type { ParentSession } from "@/server/parentAuth";
import { query } from "@/server/db";

/**
 * Connects records created by staff before a parent had an app account.
 *
 * The match deliberately uses the tenant and a normalised email address. It
 * never overwrites an application that already belongs to another parent.
 */
export async function linkExistingApplicationsToParent(parent: ParentSession) {
  await query(
    `UPDATE applications
        SET parent_account_id = $1,
            updated_at = now()
      WHERE tenant_id = $2
        AND parent_account_id IS NULL
        AND lower(trim(COALESCE(parent_email, ''))) = lower(trim($3))`,
    [parent.id, parent.tenantId, parent.email],
  );
}
