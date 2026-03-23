const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "austinm.altman@gmail.com";
const DEFAULT_FROM =
  process.env.RESEND_FROM || "Kayco Pallet Program <onboarding@resend.dev>";
const APP_URL =
  process.env.BETTER_AUTH_URL || "http://localhost:3000";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

type PasswordResetPayload = {
  user: { name?: string | null; email: string };
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set, skipping email to:", to);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: DEFAULT_FROM, to, subject, html }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to send email (${response.status}): ${message}`);
  }
}

export async function sendApprovalRequest(user: {
  name: string;
  email: string;
}) {
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New sign-up request: ${user.name} (${user.email})`,
    html: `
      <h2>New User Sign-Up Request</h2>
      <p><strong>Name:</strong> ${escapeHtml(user.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
      <p>Log in to the <a href="${APP_URL}/users">Users page</a> to approve or reject this request.</p>
    `,
  });
}

export async function sendApprovalConfirmation(user: {
  name: string;
  email: string;
}) {
  const safeName = escapeHtml(user.name);

  await sendEmail({
    to: user.email,
    subject: "Your Kayco Pallet Program account has been approved",
    html: `
      <h2>Welcome, ${safeName}!</h2>
      <p>Your account has been approved. You can now sign in.</p>
      <p style="margin:24px 0;">
        <a
          href="${APP_URL}/login"
          style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ec5b13;color:#ffffff;text-decoration:none;font-weight:600;"
        >
          Sign in to Kayco Pallet Program
        </a>
      </p>
    `,
  });
}

export async function sendPasswordReset({ user, url }: PasswordResetPayload) {
  const name = user.name?.trim() || user.email;
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);

  await sendEmail({
    to: user.email,
    subject: "Reset your Kayco Pallet Program password",
    html: `
      <h2>Password Reset Request</h2>
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your password.</p>
      <p style="margin:24px 0;">
        <a
          href="${safeUrl}"
          style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ec5b13;color:#ffffff;text-decoration:none;font-weight:600;"
        >
          Reset Password
        </a>
      </p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
