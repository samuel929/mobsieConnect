import { apiHandler } from "@/server/api";
import { clearSessionCookie } from "@/server/auth";

export default apiHandler<{ loggedOut: true }>(
  { methods: ["POST"], auth: false },
  async (_req, res) => {
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(200).json({ ok: true, data: { loggedOut: true } });
  },
);
