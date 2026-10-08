import { apiHandler } from "@/server/api";
import type { SessionUser } from "@/types/domain";

export default apiHandler<{ user: SessionUser }>(
  { methods: ["GET"] },
  async (_req, res, context) => {
    res.status(200).json({ ok: true, data: { user: context.user! } });
  },
);
