import { apiHandler, one } from "@/server/api";
import { enrolmentTerms, privacyPolicy, termsAndConditions } from "@/content/legal";
import { AppError } from "@/server/errors";

export default apiHandler<{ slug: string; title: string; updatedAt: string; sections: typeof privacyPolicy }>(
  { methods: ["GET"], auth: false },
  async (req, res) => {
    const slug = one(req.query.slug);
    if (slug !== "privacy" && slug !== "terms" && slug !== "enrolment") {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found.");
    }
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    res.status(200).json({
      ok: true,
      data: {
        slug,
        title:
          slug === "privacy"
            ? "Privacy Policy"
            : slug === "enrolment"
              ? "Terms of Enrolment (Clauses 1–16)"
              : "Terms & Conditions",
        updatedAt: "2026-08-01",
        sections:
          slug === "privacy"
            ? privacyPolicy
            : slug === "enrolment"
              ? enrolmentTerms
              : termsAndConditions,
      },
    });
  },
);
