import type { Metadata } from "next";
import Link from "next/link";
import { privacyPolicy } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Mobsie Connect",
  description: "How Mobsie Connect collects, uses, protects and retains personal information.",
};

const styles = {
  page: { minHeight: "100vh", background: "#f8f4ec", color: "#172033", padding: "48px 20px" },
  card: { maxWidth: 880, margin: "0 auto", background: "#fff", border: "1px solid #e7e2d9", borderRadius: 28, padding: "clamp(28px, 5vw, 64px)", boxShadow: "0 18px 50px rgba(23,32,51,.08)" },
  brand: { color: "#008d85", fontWeight: 800, fontSize: 18, marginBottom: 28 },
  title: { fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.05, margin: "0 0 14px" },
  lead: { fontSize: 18, lineHeight: 1.7, color: "#4b5565", marginBottom: 34 },
  section: { borderTop: "1px solid #eee9e1", paddingTop: 24, marginTop: 24 },
  heading: { fontSize: 22, margin: "0 0 9px" },
  body: { fontSize: 16, lineHeight: 1.75, color: "#374151", margin: 0 },
  footer: { borderTop: "1px solid #eee9e1", paddingTop: 28, marginTop: 36, fontSize: 15, lineHeight: 1.7, color: "#4b5565" },
} as const;

export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <article style={styles.card}>
        <div style={styles.brand}>Mobsie Connect</div>
        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.lead}>
          This policy explains how Mobsie Connect handles information supplied by authorised parents,
          guardians and school personnel. Mobsie Connect accounts are intended for adults aged 18 or older.
          Last updated: 9 October 2026.
        </p>

        {privacyPolicy.map((section) => (
          <section key={section.heading} style={styles.section}>
            <h2 style={styles.heading}>{section.heading}</h2>
            <p style={styles.body}>{section.body}</p>
          </section>
        ))}

        <footer style={styles.footer}>
          Privacy questions and requests for access, correction or deletion can be sent to{" "}
          <a href="mailto:info@mobsiekids.co.za">info@mobsiekids.co.za</a>. Requests may be subject to
          identity verification and applicable educational or legal record-retention obligations.
          <br />
          <Link href="/support">Mobsie Connect Support</Link>
        </footer>
      </article>
    </main>
  );
}
