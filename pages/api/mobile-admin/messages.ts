import { z } from "zod";

import { apiHandler, pageLimit } from "@/server/api";
import { query } from "@/server/db";
import { createAndSendNotification } from "@/server/expoPush";
import { publishRealtime } from "@/server/realtime";
import { requireDashboardPermission } from "@/server/auth";

const replySchema = z.object({
  parentAccountId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});
const readSchema = z.object({ parentAccountId: z.string().uuid() });

type MessageRow = {
  id: string;
  parentAccountId: string;
  parentName: string;
  parentEmail: string;
  senderType: "PARENT" | "SCHOOL";
  senderName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type ParentRow = {
  id: string;
  name: string;
};

export default apiHandler<MessageRow[]>(
  {
    methods: ["GET", "POST", "PATCH"],
    roles: ["PRINCIPAL", "TEACHER"],
  },

  async (req, res, { user }) => {
    await requireDashboardPermission(user!, "Messages");
    if (req.method === "PATCH") {
      const input = readSchema.parse(req.body);
      await query(
        `UPDATE parent_messages SET read_at=COALESCE(read_at,now())
         WHERE tenant_id=$1 AND parent_account_id=$2 AND sender_type='PARENT'
           AND ($3::text='PRINCIPAL' OR EXISTS (
             SELECT 1 FROM parent_accounts p WHERE p.id=parent_messages.parent_account_id
               AND (p.preferred_branch_id=$4::uuid OR EXISTS (
                 SELECT 1 FROM students s WHERE s.parent_account_id=p.id AND s.branch_id=$4::uuid))))`,
        [user!.tenantId,input.parentAccountId,user!.role,user!.branchId],
      );
      res.status(200).json({ok:true,data:[]});return;
    }
    /**
     * -----------------------------------------
     * POST
     * Principal / school sends message to parent
     * -----------------------------------------
     */
    if (req.method === "POST") {
      const input = replySchema.parse(req.body);

      /**
       * Make sure the parent:
       * - exists
       * - belongs to the same tenant
       * - is active
       */
      const parent = await query<ParentRow>(
        `
          SELECT id, COALESCE(NULLIF(TRIM(name), ''), email::text, 'Parent') AS name
          FROM parent_accounts
          WHERE id = $1
            AND tenant_id = $2
            AND is_active = true
            AND (
              $3::uuid IS NULL OR $4::text = 'PRINCIPAL'
              OR preferred_branch_id = $3
              OR EXISTS (SELECT 1 FROM students s WHERE s.parent_account_id=parent_accounts.id AND s.branch_id=$3)
            )
          LIMIT 1
        `,
        [input.parentAccountId, user!.tenantId, user!.branchId, user!.role],
      );

      if (!parent.rows[0]) {
        res.status(404).json({
          ok: false,
          error: {
            code: "PARENT_NOT_FOUND",
            message: "The parent account no longer exists.",
          },
        });

        return;
      }

      /**
       * Save message into PostgreSQL.
       */
      const result = await query<MessageRow>(
        `
          INSERT INTO parent_messages (
            tenant_id,
            parent_account_id,
            sender_type,
            sender_name,
            body
          )
          VALUES (
            $1,
            $2,
            'SCHOOL',
            $3,
            $4
          )
          RETURNING
            id,
            parent_account_id AS "parentAccountId",
            ''::text AS "parentName",
            ''::text AS "parentEmail",
            sender_type AS "senderType",
            sender_name AS "senderName",
            body,
            read_at::text AS "readAt",
            created_at::text AS "createdAt"
        `,
        [
          user!.tenantId,
          input.parentAccountId,
          user!.name || "School",
          input.body,
        ],
      );

      publishRealtime("messages", user!.tenantId, input.parentAccountId);

      // The message is already safely stored at this point. A temporary push
      // provider outage must not make the dashboard resend and duplicate it.
      try {
        const message = result.rows[0];
        await createAndSendNotification({
          tenantId: user!.tenantId,
          parentAccountId: input.parentAccountId,
          title: `New message from ${user!.name || "Mobsie Kids"}`,
          body: input.body.length > 140 ? `${input.body.slice(0, 137)}...` : input.body,
          audience: parent.rows[0].name,
          sourceType: "PARENT_MESSAGE",
          sourceId: message.id,
          data: {
            screen: "Messages",
            messageId: message.id,
          },
        });
      } catch (pushError) {
        console.error("Failed to send parent message push notification", pushError);
      }

      res.status(201).json({
        ok: true,
        data: result.rows,
      });

      return;
    }

    /**
     * -----------------------------------------
     * GET
     * Load every parent conversation
     * -----------------------------------------
     */

    const limit = pageLimit(req.query.limit, 500);

    const result = await query<MessageRow>(
      `
        SELECT
          m.id,
          m.parent_account_id AS "parentAccountId",

          COALESCE(
            NULLIF(TRIM(p.name), ''),
            p.email::text,
            'Parent'
          ) AS "parentName",

          p.email::text AS "parentEmail",

          m.sender_type AS "senderType",
          m.sender_name AS "senderName",
          m.body,

          m.read_at::text AS "readAt",
          m.created_at::text AS "createdAt"

        FROM parent_messages m

        INNER JOIN parent_accounts p
          ON p.id = m.parent_account_id
         AND p.tenant_id = m.tenant_id

        WHERE m.tenant_id = $1
          AND (
            $3::uuid IS NULL OR $4::text = 'PRINCIPAL'
            OR p.preferred_branch_id = $3
            OR EXISTS (SELECT 1 FROM students s WHERE s.parent_account_id=p.id AND s.branch_id=$3)
          )

        ORDER BY
          m.created_at DESC,
          m.id DESC

        LIMIT $2
      `,
      [user!.tenantId, limit, user!.branchId, user!.role],
    );

    res.status(200).json({
      ok: true,
      data: result.rows,
    });
  },
);
