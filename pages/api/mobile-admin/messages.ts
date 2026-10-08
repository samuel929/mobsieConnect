import { z } from "zod";

import { apiHandler, pageLimit } from "@/server/api";
import { query } from "@/server/db";
import { publishRealtime } from "@/server/realtime";

const replySchema = z.object({
  parentAccountId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

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
};

export default apiHandler<MessageRow[]>(
  {
    methods: ["GET", "POST"],
    roles: ["PRINCIPAL"],
  },

  async (req, res, { user }) => {
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
          SELECT id
          FROM parent_accounts
          WHERE id = $1
            AND tenant_id = $2
            AND is_active = true
          LIMIT 1
        `,
        [input.parentAccountId, user!.tenantId],
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

        ORDER BY
          m.created_at DESC,
          m.id DESC

        LIMIT $2
      `,
      [user!.tenantId, limit],
    );

    res.status(200).json({
      ok: true,
      data: result.rows,
    });
  },
);
