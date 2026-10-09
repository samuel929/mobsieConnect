import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Mobsie Connect",
  description: "Contact Mobsie Connect support for account, enrolment and application assistance.",
};

export default function SupportPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8f4ec", color: "#172033", padding: "48px 20px", display: "grid", placeItems: "center" }}>
      <article style={{ width: "100%", maxWidth: 760, background: "#fff", border: "1px solid #e7e2d9", borderRadius: 28, padding: "clamp(28px, 5vw, 64px)", boxShadow: "0 18px 50px rgba(23,32,51,.08)" }}>
        <div style={{ color: "#008d85", fontWeight: 800, fontSize: 18, marginBottom: 28 }}>Mobsie Connect</div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.05, margin: "0 0 14px" }}>How can we help?</h1>
        <p style={{ fontSize: 18, lineHeight: 1.7, color: "#4b5565", marginBottom: 34 }}>
          Contact us for help with your account, enrolment application, approval status, documents,
          payments, notifications or access to your child&apos;s school information.
        </p>
        <section style={{ borderRadius: 20, background: "#edf9f7", border: "1px solid #ccece8", padding: 24 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Email support</h2>
          <a href="mailto:info@mobsiekids.co.za" style={{ color: "#00766f", fontSize: 18, fontWeight: 700 }}>info@mobsiekids.co.za</a>
          <p style={{ margin: "12px 0 0", color: "#4b5565", lineHeight: 1.6 }}>
            Include the parent or guardian&apos;s name and application reference where applicable. Do not send passwords by email.
          </p>
        </section>
        <p style={{ margin: "28px 0 0", color: "#4b5565" }}>
          Read our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </article>
    </main>
  );
}
