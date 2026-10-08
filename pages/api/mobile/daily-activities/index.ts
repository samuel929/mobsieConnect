import { apiHandler } from "@/server/api";
import { getParent } from "@/server/parentAuth";
import { getParentDailyActivities } from "@/server/dailyActivities";

export default apiHandler<unknown[]>(
  { methods: ["GET"], auth: false },
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const parent = await getParent(req);
    const activities = await getParentDailyActivities(parent);
    res.status(200).json({ ok: true, data: activities });
  },
);
