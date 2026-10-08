import { apiHandler, one } from "@/server/api";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";
import { getParentEvents } from "@/server/parentScope";

/** Parent-safe calendar feed. Global events are included; branch events are scoped. */
export default apiHandler<unknown[]>({ methods: ["GET"], auth: false }, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const parent = await getParent(req);
  const from = one(req.query.from);
  const to = one(req.query.to);
  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
    throw new AppError(422, "INVALID_DATE_RANGE", "Calendar dates must be valid ISO dates.");
  }
  const events = await getParentEvents(parent, { from, to });
  res.status(200).json({ ok: true, data: events });
});
