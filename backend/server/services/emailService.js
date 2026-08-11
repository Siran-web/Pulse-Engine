/**
 * services/emailService.js — Nodemailer Email Service
 *
 * MODULE FLOW:
 *  1. createTransport() builds a reusable Gmail SMTP transporter once at startup
 *  2. Individual send functions are exported for each email trigger
 *  3. Route handlers call these functions after DB operations succeed
 *
 * EMAIL TRIGGERS:
 *  sendApprovalEmail()       — user approved → welcome with role details
 *  sendRejectionEmail()      — user rejected → polite rejection notice
 *  sendNewSignupAlert()      — new signup    → notify hospital admin
 *  sendAdminApprovalEmail()  — admin approved by super_admin → hospital setup guide
 *
 * SETUP REQUIREMENTS:
 *  1. Create a Gmail account (or use existing)
 *  2. Enable 2-Step Verification on the account
 *  3. Generate an App Password: Google Account → Security → App Passwords
 *  4. Set EMAIL_USER and EMAIL_PASS in server/.env
 *
 * NOTE: Raw Gmail password will NOT work — App Password required
 */

const nodemailer = require("nodemailer");

// ── Create reusable SMTP transporter ─────────────────────────────────────────
// This object is created once when the module loads — not per email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password, not real password
  },
});

// ── Verify transporter on startup (optional — helps catch config errors) ─────
transporter.verify((err) => {
  if (err) {
    console.warn("⚠️   Email transporter verification failed:", err.message);
    console.warn(
      "    Emails will not be sent. Check EMAIL_USER and EMAIL_PASS in .env",
    );
  } else {
    console.log("✅  Email transporter ready (Gmail SMTP)");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROLE DESCRIPTIONS — used in welcome emails
// ══════════════════════════════════════════════════════════════════════════════

const ROLE_DESCRIPTIONS = {
  admin:
    "Hospital Administrator — manage staff approvals, upload patient data, view patient risk overview.",
  doctor:
    "Doctor — view full patient vitals, risk scores, matched rules, and use the clinical chatbot.",
  insurance:
    "Insurance Analyst — view financial risk data across linked hospitals, view critical patient lists.",
};

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL SEND FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * sendApprovalEmail — sent to a user when admin/super_admin approves them
 *
 * @param {string} toEmail  - recipient email
 * @param {string} userName - recipient's full name
 * @param {string} role     - approved role (admin/doctor/insurance)
 * @param {string} orgName  - hospital or insurance org name
 */
const sendApprovalEmail = async (toEmail, userName, role, orgName) => {
  const roleDesc =
    ROLE_DESCRIPTIONS[role] ||
    "Access granted to the Patient Evaluation Engine.";

  const mailOptions = {
    from: `"Patient Evaluation Engine" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `✅ Account Approved — Your role: ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #2563eb;">Account Approved</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Your account on the <strong>Patient Evaluation Engine</strong> has been approved.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; background: #f1f5f9; font-weight: bold;">Organisation</td>
            <td style="padding: 8px;">${orgName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f1f5f9; font-weight: bold;">Assigned Role</td>
            <td style="padding: 8px; color: #2563eb; font-weight: bold;">${role.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f1f5f9; font-weight: bold;">What you can do</td>
            <td style="padding: 8px;">${roleDesc}</td>
          </tr>
        </table>
        <a href="http://localhost:3000/login"
           style="display:inline-block; background:#2563eb; color:#fff;
                  padding:10px 24px; border-radius:6px; text-decoration:none;">
          Log In Now
        </a>
        <p style="margin-top:24px; color:#64748b; font-size:13px;">
          If you have any issues, contact your hospital administrator.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧  Approval email sent to ${toEmail}`);
  } catch (err) {
    // Log but don't throw — approval should succeed even if email fails
    console.error("❌  Failed to send approval email:", err.message);
  }
};

/**
 * sendRejectionEmail — sent to a user when their account is rejected
 *
 * @param {string} toEmail  - recipient email
 * @param {string} userName - recipient's full name
 * @param {string} reason   - optional reason for rejection
 */
const sendRejectionEmail = async (toEmail, userName, reason = "") => {
  const mailOptions = {
    from: `"Patient Evaluation Engine" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Account Registration — Update",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #dc2626;">Registration Update</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>
          After review, we were unable to approve your account on the
          <strong>Patient Evaluation Engine</strong> at this time.
        </p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>
          If you believe this is an error or would like to clarify your details,
          please contact your hospital administrator directly.
        </p>
        <p style="color:#64748b; font-size:13px;">
          This is an automated message from the Patient Evaluation Engine.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧  Rejection email sent to ${toEmail}`);
  } catch (err) {
    console.error("❌  Failed to send rejection email:", err.message);
  }
};

/**
 * sendNewSignupAlert — sent to admin when a new user signs up for their hospital
 *
 * @param {string} adminEmail   - hospital admin's email
 * @param {string} adminName    - hospital admin's name
 * @param {string} newUserName  - the new pending user's name
 * @param {string} newUserEmail - the new pending user's email
 * @param {string} orgName      - organisation they signed up for
 */
const sendNewSignupAlert = async (
  adminEmail,
  adminName,
  newUserName,
  newUserEmail,
  orgName,
) => {
  const mailOptions = {
    from: `"Patient Evaluation Engine" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🔔 New Pending User — ${newUserName} waiting for approval`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #d97706;">New Signup Awaiting Approval</h2>
        <p>Hello <strong>${adminName}</strong>,</p>
        <p>
          A new user has registered for <strong>${orgName}</strong>
          and is waiting for your approval.
        </p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; background: #fef3c7; font-weight: bold;">Name</td>
            <td style="padding: 8px;">${newUserName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #fef3c7; font-weight: bold;">Email</td>
            <td style="padding: 8px;">${newUserEmail}</td>
          </tr>
        </table>
        <a href="http://localhost:3000/dashboard"
           style="display:inline-block; background:#d97706; color:#fff;
                  padding:10px 24px; border-radius:6px; text-decoration:none;">
          Review in Dashboard
        </a>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧  Signup alert sent to admin ${adminEmail}`);
  } catch (err) {
    console.error("❌  Failed to send signup alert:", err.message);
  }
};

/**
 * sendAdminApprovalEmail — sent to a newly approved hospital admin by super_admin
 *
 * @param {string} toEmail      - new admin's email
 * @param {string} adminName    - new admin's name
 * @param {string} hospitalName - the hospital they now manage
 */
const sendAdminApprovalEmail = async (toEmail, adminName, hospitalName) => {
  const mailOptions = {
    from: `"Patient Evaluation Engine" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `✅ You are now Administrator of ${hospitalName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #16a34a;">Hospital Administrator Account Approved</h2>
        <p>Hello <strong>${adminName}</strong>,</p>
        <p>
          You have been approved as the <strong>Administrator</strong> of
          <strong>${hospitalName}</strong> on the Patient Evaluation Engine.
        </p>
        <h3>Your Next Steps:</h3>
        <ol>
          <li>Log in at <a href="http://localhost:3000/login">localhost:3000/login</a></li>
          <li>Go to your Admin Dashboard</li>
          <li>Upload the first patient Excel file to start evaluations</li>
          <li>Approve doctor accounts as your team registers</li>
          <li>Create hospital-specific evaluation rules if needed</li>
        </ol>
        <a href="http://localhost:3000/login"
           style="display:inline-block; background:#16a34a; color:#fff;
                  padding:10px 24px; border-radius:6px; text-decoration:none;">
          Go to Dashboard
        </a>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧  Admin approval email sent to ${toEmail}`);
  } catch (err) {
    console.error("❌  Failed to send admin approval email:", err.message);
  }
};

module.exports = {
  sendApprovalEmail,
  sendRejectionEmail,
  sendNewSignupAlert,
  sendAdminApprovalEmail,
};
