// 📁 PATH: src/services/emailService.js
'use strict';

const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// Core Brevo API helper  (raw https — no extra dependency)
// ─────────────────────────────────────────────────────────────────────────────
const sendBrevoEmail = ({ to, toName, subject, htmlContent }) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      sender:      { name: 'Moom24', email: process.env.BREVO_SENDER_EMAIL || 'h.m.rahimnet@gmail.com' },
      to:          [{ email: to, name: toName }],
      subject,
      htmlContent,
    });

    const options = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'api-key':        process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || '{}'));
        } else {
          reject(new Error(`Brevo API error: ${res.statusCode} – ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP generator (6-digit numeric)
// ─────────────────────────────────────────────────────────────────────────────
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built email templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP for email verification.
 * @param {{ email: string, name: string, otp: string }} options
 */
const sendVerificationOtp = ({ email, name, otp }) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0"
            style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
                   border-radius:20px;border:1px solid rgba(99,102,241,0.3);
                   overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="padding:36px 40px 28px;text-align:center;
                         background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                  Moom24
                </h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
                  Email Verification
                </p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 8px;color:#a1a1aa;font-size:15px;">
                  Hi <strong style="color:#e4e4e7;">${name}</strong>,
                </p>
                <p style="margin:0 0 28px;color:#a1a1aa;font-size:15px;line-height:1.6;">
                  Use the code below to verify your email address.
                  This code is valid for <strong style="color:#6366f1;">10 minutes</strong>.
                </p>

                <!-- OTP Box -->
                <div style="background:rgba(99,102,241,0.12);border:2px solid rgba(99,102,241,0.4);
                            border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;">
                  <p style="margin:0 0 8px;color:#71717a;font-size:12px;letter-spacing:3px;text-transform:uppercase;">
                    Verification Code
                  </p>
                  <p style="margin:0;font-size:48px;font-weight:800;letter-spacing:16px;
                             color:#818cf8;font-family:'Courier New',monospace;">
                    ${otp}
                  </p>
                </div>

                <p style="margin:0;color:#52525b;font-size:13px;text-align:center;line-height:1.6;">
                  If you didn't request this, you can safely ignore this email.<br>
                  Do <strong>not</strong> share this code with anyone.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                <p style="margin:0;color:#3f3f46;font-size:12px;">
                  © ${new Date().getFullYear()} Moom24. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  return sendBrevoEmail({
    to:          email,
    toName:      name,
    subject:     'Your Moom24 Verification Code',
    htmlContent,
  });
};

/**
 * Send a password-reset OTP.
 * @param {{ email: string, name: string, otp: string }} options
 */
const sendPasswordResetOtp = ({ email, name, otp }) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <body style="margin:0;padding:40px 0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#1a1a2e;border-radius:20px;border:1px solid rgba(239,68,68,0.3);overflow:hidden;">
          <tr>
            <td style="padding:36px 40px 28px;text-align:center;background:linear-gradient(135deg,#dc2626,#b91c1c);">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Moom24</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Password Reset</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;">
                Hi <strong style="color:#e4e4e7;">${name}</strong>, here is your password reset code:
              </p>
              <div style="background:rgba(239,68,68,0.1);border:2px solid rgba(239,68,68,0.4);
                          border-radius:16px;padding:28px;text-align:center;">
                <p style="margin:0;font-size:48px;font-weight:800;letter-spacing:16px;
                           color:#f87171;font-family:'Courier New',monospace;">${otp}</p>
              </div>
              <p style="margin:24px 0 0;color:#52525b;font-size:13px;text-align:center;">
                Valid for 10 minutes. Never share this code.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

  return sendBrevoEmail({
    to:          email,
    toName:      name,
    subject:     'Moom24 Password Reset Code',
    htmlContent,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  sendBrevoEmail,       // raw helper — যেকোনো custom email পাঠাতে
  sendVerificationOtp,  // signup OTP
  sendPasswordResetOtp, // forgot-password OTP
  generateOtp,          // 6-digit OTP generator
};