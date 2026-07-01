// 📁 PATH: src/controllers/emailController.js
'use strict';

const User       = require('../models/User');
const EmailLog    = require('../models/EmailLogModel');
const { sendBrevoEmail } = require('../services/emailService');

// ─────────────────────────────────────────────────────────────────────────────
// Shared, branded HTML template for admin → custom/user email blasts
// ─────────────────────────────────────────────────────────────────────────────
function buildBlastEmailHtml({ name, subject, message, adminName }) {
  // message আসে plain text হিসেবে — newline গুলো <br> এ convert করি, কিন্তু
  // user-supplied text safely escape করার পর
  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
            style="max-width:560px;width:100%;background-color:#15151f;border-radius:24px;overflow:hidden;
                   border:1px solid rgba(99,102,241,0.18);box-shadow:0 20px 60px rgba(99,102,241,0.15);">

            <!-- Header -->
            <tr>
              <td style="padding:40px 40px 32px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%);text-align:center;">
                <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,0.15);
                            border-radius:14px;line-height:52px;margin-bottom:14px;">
                  <span style="font-size:24px;">📩</span>
                </div>
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Moom24</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;
                          text-transform:uppercase;letter-spacing:1.5px;">Message from the Moom24 team</p>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:32px 40px 0;">
                <p style="margin:0;color:#f4f4f5;font-size:16px;">
                  Hi <strong style="color:#ffffff;">${name || 'there'}</strong>, 👋
                </p>
              </td>
            </tr>

            <!-- Message body -->
            <tr>
              <td style="padding:18px 40px 8px;">
                <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);
                            border-radius:14px;padding:22px;color:#e4e4e7;font-size:14.5px;line-height:1.8;">
                  ${safeMessage}
                </div>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:32px 40px 8px;" align="center">
                <a href="https://moom24.com"
                  style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;
                         font-size:14px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:12px;
                         box-shadow:0 8px 24px rgba(99,102,241,0.35);">
                  Visit Moom24 →
                </a>
              </td>
            </tr>

            <!-- Signature -->
            <tr>
              <td style="padding:24px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);margin-top:20px;">
                <p style="margin:0;color:#52525b;font-size:13px;text-align:center;">
                  Warm regards,<br/>
                  <span style="color:#a1a1aa;font-weight:600;">${adminName || 'Moom24 Team'}</span>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/email/users
// Admin dashboard-এ user picker list দেখানোর জন্য — search + role filter + pagination
// ─────────────────────────────────────────────────────────────────────────────
exports.adminListUsers = async (req, res) => {
  try {
    const { search = '', role = '', page = 1, limit = 50 } = req.query;

    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (search.trim()) {
      const q = search.trim();
      filter.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName:  { $regex: q, $options: 'i' } },
        { email:     { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('firstName lastName email avatar role isActive createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    return res.json({ data: users, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('adminListUsers error:', err);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/email/send
// Body: {
//   userIds:  [ObjectId]   — selected users থেকে recipients (optional)
//   emails:   [string]     — হাতে লেখা যেকোনো email address (optional)
//   subject:  string
//   message:  string
// }
// অন্তত একজন recipient (userIds বা emails থেকে) থাকতেই হবে।
// ─────────────────────────────────────────────────────────────────────────────
exports.adminSendEmail = async (req, res) => {
  try {
    const { userIds = [], emails = [], subject, message } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Subject is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // ── Build the unique recipient list ──────────────────────────────────
    const recipientMap = new Map(); // email(lowercase) -> { email, name, userId }

    // ১. Selected users থেকে recipients
    if (Array.isArray(userIds) && userIds.length > 0) {
      const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email');
      users.forEach((u) => {
        const email = (u.email || '').toLowerCase().trim();
        if (!email) return;
        recipientMap.set(email, {
          email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          userId: u._id,
        });
      });
    }

    // ২. হাতে লেখা email addresses
    if (Array.isArray(emails) && emails.length > 0) {
      emails.forEach((raw) => {
        const email = String(raw || '').toLowerCase().trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
        if (!recipientMap.has(email)) {
          recipientMap.set(email, { email, name: '', userId: null });
        }
      });
    }

    const recipients = Array.from(recipientMap.values());

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'Select at least one user or enter at least one valid email address' });
    }

    const adminName = req.user?.fullName || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Moom24 Team';

    // ── Send emails (parallel, but failures don't stop the batch) ────────
    const results = await Promise.allSettled(
      recipients.map((r) =>
        sendBrevoEmail({
          to:      r.email,
          toName:  r.name || r.email,
          subject: subject.trim(),
          htmlContent: buildBlastEmailHtml({
            name:    r.name,
            subject: subject.trim(),
            message: message.trim(),
            adminName,
          }),
        })
      )
    );

    const recipientResults = recipients.map((r, i) => {
      const res_ = results[i];
      return {
        email:  r.email,
        name:   r.name,
        userId: r.userId,
        status: res_.status === 'fulfilled' ? 'sent' : 'failed',
        error:  res_.status === 'rejected' ? String(res_.reason?.message || res_.reason) : null,
      };
    });

    const sentCount   = recipientResults.filter((r) => r.status === 'sent').length;
    const failedCount = recipientResults.filter((r) => r.status === 'failed').length;

    const recipientMode =
      userIds.length > 0 && emails.length > 0 ? 'mixed' : userIds.length > 0 ? 'users' : 'custom';

    const log = await EmailLog.create({
      subject:       subject.trim(),
      message:       message.trim(),
      recipientMode,
      recipients:    recipientResults,
      totalCount:    recipientResults.length,
      sentCount,
      failedCount,
      sentBy:        req.user?._id,
      sentByName:    adminName,
    });

    return res.status(201).json({
      message: `Email sent to ${sentCount} of ${recipientResults.length} recipient(s)`,
      data: log,
    });
  } catch (err) {
    console.error('adminSendEmail error:', err);
    return res.status(500).json({ message: 'Failed to send email. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/email/history  — recent blasts sent from the dashboard
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      EmailLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-recipients.error'),
      EmailLog.countDocuments(),
    ]);

    return res.json({ data: logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('adminGetHistory error:', err);
    return res.status(500).json({ message: 'Failed to fetch email history' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/email/history/:id  — single blast detail (per-recipient status)
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetHistoryById = async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Email log not found' });
    return res.json({ data: log });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch email log' });
  }
};