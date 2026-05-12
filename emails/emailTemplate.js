// ─────────────────────────────────────────
//  Welcome Email Template
// ─────────────────────────────────────────
export const welcomeEmailTemplate = (name) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #f9f9f9; border-radius: 10px;">
  <h2 style="color: #6366f1;">👋 Welcome to ChatApp, ${name}!</h2>
  <p style="font-size: 16px; color: #333;">
    We're excited to have you on board. Start connecting with friends and family today!
  </p>
  <p style="margin-top: 30px; font-size: 13px; color: #aaa;">If you didn't create this account, please ignore this email.</p>
</div>
`;

// ─────────────────────────────────────────
//  Password Reset OTP Template  ← नवीन
//  OTP-based reset (Mobile App साठी)
// ─────────────────────────────────────────
export const passwordResetOtpTemplate = (name, otp) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #0a0f1e; border-radius: 16px; border: 1px solid #1e2a3a;">
  <div style="text-align: center; margin-bottom: 28px;">
    <div style="display: inline-block; background: #6366f1; border-radius: 16px; padding: 16px 24px;">
      <span style="font-size: 32px;">🔑</span>
    </div>
  </div>

  <h2 style="color: #f0f4ff; text-align: center; margin: 0 0 8px;">Password Reset OTP</h2>
  <p style="color: #64748b; text-align: center; font-size: 14px; margin: 0 0 28px;">Hi ${name}, use the OTP below to reset your password</p>

  <!-- OTP Box -->
  <div style="background: #111827; border: 2px solid #6366f1; border-radius: 14px; padding: 28px; text-align: center; margin: 0 0 24px;">
    <p style="color: #64748b; font-size: 13px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
    <div style="letter-spacing: 12px; font-size: 42px; font-weight: 900; color: #6366f1; font-family: 'Courier New', monospace;">
      ${otp}
    </div>
    <p style="color: #64748b; font-size: 13px; margin: 14px 0 0;">⏱ Valid for <strong style="color: #f59e0b;">15 minutes</strong></p>
  </div>

  <!-- Warning -->
  <div style="background: #1a2235; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px;">
    <p style="color: #93c5fd; font-size: 13px; margin: 0;">
      🔒 <strong>Security tip:</strong> Never share this OTP with anyone. ChatApp will never ask for your OTP.
    </p>
  </div>

  <p style="color: #475569; font-size: 13px; text-align: center; margin: 0;">
    If you didn't request this, you can safely ignore this email.
  </p>
</div>
`;

// ─────────────────────────────────────────
//  Password Reset Link Template (legacy — kept for reference)
// ─────────────────────────────────────────
export const passwordResetTemplate = (resetLink) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #f9f9f9; border-radius: 10px;">
  <h2 style="color: #DC2626;">🔑 Password Reset Request</h2>
  <p style="font-size: 16px; color: #333;">
    You requested a password reset. Click the button below to proceed:
  </p>
  <a href="${resetLink}" style="display:inline-block; margin-top:20px; padding: 12px 24px; background:#DC2626; color:#fff; border-radius:6px; text-decoration:none; font-size:15px;">
    Reset Password →
  </a>
  <p style="margin-top: 20px; font-size: 14px; color: #888;">
    This link will <strong>expire in 15 minutes</strong>.
  </p>
  <p style="margin-top: 30px; font-size: 13px; color: #aaa;">If you didn't request this, please ignore this email.</p>
</div>
`;

// ─────────────────────────────────────────
//  Friend Request Template
// ─────────────────────────────────────────
export const friendRequestTemplate = (senderName) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #f9f9f9; border-radius: 10px;">
  <h2 style="color: #6366f1;">👥 New Friend Request</h2>
  <p style="font-size: 16px; color: #333;">
    <strong>${senderName}</strong> sent you a friend request on ChatApp!
  </p>
  <p style="margin-top: 30px; font-size: 13px; color: #aaa;">Open the app to accept or decline.</p>
</div>
`;