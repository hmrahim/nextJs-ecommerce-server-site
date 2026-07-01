// 📁 PATH: controllers/contactController.js

const ContactMessage = require('../models/ContactMessage');
const { sendBrevoEmail } = require('../services/emailService');

// ─────────────────────────────────────────────────────────────────────────────
// Admin notification template — reuses the same sendBrevoEmail helper that
// powers signup / password-reset OTP emails.
// ─────────────────────────────────────────────────────────────────────────────
function buildAdminNotificationHtml({ name, email, phone, subject, message }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Contact Message</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
            style="max-width:560px;width:100%;background-color:#15151f;border-radius:24px;overflow:hidden;
                   border:1px solid rgba(129,140,248,0.18);box-shadow:0 20px 60px rgba(99,102,241,0.15);">

            <!-- Header -->
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:40px 40px 32px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%);text-align:center;">
                      <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,0.15);
                                  border-radius:14px;line-height:52px;margin-bottom:14px;">
                        <span style="font-size:24px;">✉️</span>
                      </div>
                      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Moom24</h1>
                      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;
                                text-transform:uppercase;letter-spacing:1.5px;">New Contact Message</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Badge strip -->
            <tr>
              <td style="padding:24px 40px 0;">
                <span style="display:inline-block;background:rgba(99,102,241,0.15);color:#a5b4fc;
                             font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;
                             padding:6px 14px;border-radius:999px;border:1px solid rgba(99,102,241,0.3);">
                  ⚡ Action needed — new inquiry
                </span>
              </td>
            </tr>

            <!-- Sender info card -->
            <tr>
              <td style="padding:24px 40px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                  style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                         border-radius:16px;padding:4px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:6px 0;width:90px;color:#71717a;font-size:13px;font-weight:500;">Name</td>
                          <td style="padding:6px 0;color:#f4f4f5;font-size:14px;font-weight:600;">${name}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;width:90px;color:#71717a;font-size:13px;font-weight:500;">Email</td>
                          <td style="padding:6px 0;">
                            <a href="mailto:${email}" style="color:#a5b4fc;font-size:14px;text-decoration:none;font-weight:600;">${email}</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;width:90px;color:#71717a;font-size:13px;font-weight:500;">Phone</td>
                          <td style="padding:6px 0;color:#f4f4f5;font-size:14px;font-weight:600;">${phone || '—'}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;width:90px;color:#71717a;font-size:13px;font-weight:500;">Subject</td>
                          <td style="padding:6px 0;color:#f4f4f5;font-size:14px;font-weight:600;">${subject}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Message body -->
            <tr>
              <td style="padding:20px 40px 8px;">
                <p style="margin:0 0 10px;color:#71717a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                  Message
                </p>
                <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);
                            border-radius:14px;padding:20px;white-space:pre-wrap;color:#e4e4e7;
                            font-size:14px;line-height:1.75;">${message}</div>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:28px 40px 36px;" align="center">
                <a href="mailto:${email}"
                  style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;
                         font-size:14px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:12px;
                         box-shadow:0 8px 24px rgba(99,102,241,0.35);">
                  Reply to ${name.split(' ')[0]} →
                </a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);" align="center">
                <p style="margin:0;color:#52525b;font-size:12px;">Sent automatically by the Moom24 contact form</p>
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
// POST /contact  — public, customer submits the contact form
// ─────────────────────────────────────────────────────────────────────────────
exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required' });
    }

    const contact = await ContactMessage.create({
      name,
      email,
      phone,
      subject: subject || 'General inquiry',
      message,
    });

    try {
      const { createAdminNotification } = require('./notification.controller');
      await createAdminNotification({
        type: 'system',
        title: 'New Contact Inquiry',
        message: `Inquiry from ${name} (${email}): "${contact.subject}"`,
        data: { contactId: contact._id }
      });
    } catch (err) {
      console.error('Failed to create contact admin notification:', err);
    }

    // Notify admin — never block the response if email sending fails
    try {
      await sendBrevoEmail({
        to:      process.env.ADMIN_NOTIFY_EMAIL || process.env.BREVO_SENDER_EMAIL,
        toName:  'Moom24 Admin',
        subject: `New contact message: ${contact.subject}`,
        htmlContent: buildAdminNotificationHtml({ name, email, phone, subject: contact.subject, message }),
      });
    } catch (mailErr) {
      console.error('Contact notify email failed:', mailErr.message);
    }

    return res.status(201).json({ message: 'Message sent successfully', data: contact });
  } catch (err) {
    console.error('submitContact error:', err);
    return res.status(500).json({ message: 'Failed to send message. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/contact  — admin, list all messages (newest first)
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};

    const skip = (Number(page) - 1) * Number(limit);
    const [messages, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ContactMessage.countDocuments(filter),
    ]);

    return res.json({ data: messages, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('adminGetAll (contact) error:', err);
    return res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/contact/:id  — admin, single message (auto-marks as read)
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetById = async (req, res) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    if (msg.status === 'new') {
      msg.status = 'read';
      await msg.save();
    }

    return res.json({ data: msg });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch message' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/contact/:id/reply  — admin replies, email goes out to customer
// ─────────────────────────────────────────────────────────────────────────────
function buildCustomerReplyHtml({ customerName, originalMessage, replyMessage, adminName }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reply from Moom24</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
            style="max-width:560px;width:100%;background-color:#15151f;border-radius:24px;overflow:hidden;
                   border:1px solid rgba(16,185,129,0.18);box-shadow:0 20px 60px rgba(16,185,129,0.15);">

            <!-- Header -->
            <tr>
              <td style="padding:40px 40px 32px;background:linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%);text-align:center;">
                <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,0.18);
                            border-radius:14px;line-height:52px;margin-bottom:14px;">
                  <span style="font-size:24px;">💬</span>
                </div>
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Moom24</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:500;
                          text-transform:uppercase;letter-spacing:1.5px;">We replied to your message</p>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:32px 40px 0;">
                <p style="margin:0;color:#f4f4f5;font-size:16px;">
                  Hi <strong style="color:#ffffff;">${customerName}</strong>, 👋
                </p>
                <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;line-height:1.6;">
                  Thanks for reaching out — here's our reply to your message.
                </p>
              </td>
            </tr>

            <!-- Reply card -->
            <tr>
              <td style="padding:20px 40px 8px;">
                <p style="margin:0 0 10px;color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                  Our Reply
                </p>
                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.28);
                            border-radius:14px;padding:20px;white-space:pre-wrap;color:#e4e4e7;
                            font-size:14px;line-height:1.75;">${replyMessage}</div>
              </td>
            </tr>

            <!-- Original message (collapsed look) -->
            <tr>
              <td style="padding:20px 40px 0;">
                <p style="margin:0 0 8px;color:#71717a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                  Your Original Message
                </p>
                <div style="border-left:3px solid rgba(255,255,255,0.12);padding:10px 16px;
                            color:#71717a;font-size:13px;line-height:1.7;white-space:pre-wrap;
                            background:rgba(255,255,255,0.02);border-radius:0 10px 10px 0;">${originalMessage}</div>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:32px 40px 8px;" align="center">
                <a href="https://moom24.com"
                  style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;
                         font-size:14px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:12px;
                         box-shadow:0 8px 24px rgba(16,185,129,0.35);">
                  Visit Moom24 →
                </a>
              </td>
            </tr>

            <!-- Signature -->
            <tr>
              <td style="padding:24px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);margin-top:20px;">
                <p style="margin:0;color:#52525b;font-size:13px;text-align:center;">
                  Warm regards,<br/>
                  <span style="color:#a1a1aa;font-weight:600;">${adminName || 'Moom24 Support Team'}</span>
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

exports.adminReply = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    const contact = await ContactMessage.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: 'Message not found' });

    await sendBrevoEmail({
      to:      contact.email,
      toName:  contact.name,
      subject: `Re: ${contact.subject}`,
      htmlContent: buildCustomerReplyHtml({
        customerName:    contact.name,
        originalMessage: contact.message,
        replyMessage:    message,
        adminName:       req.user?.fullName,
      }),
    });

    contact.replies.push({
      message,
      repliedBy:     req.user?._id,
      repliedByName: req.user?.fullName || 'Admin',
    });
    contact.status = 'replied';
    await contact.save();

    return res.json({ message: 'Reply sent successfully', data: contact });
  } catch (err) {
    console.error('adminReply error:', err);
    return res.status(500).json({ message: 'Failed to send reply. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/contact/:id/status  — admin, update status (new/read/replied)
// ─────────────────────────────────────────────────────────────────────────────
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Message not found' });

    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update status' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/contact/stats  — admin, quick counts for badges/widgets
// ─────────────────────────────────────────────────────────────────────────────
exports.adminStats = async (req, res) => {
  try {
    const [total, newCount, readCount, repliedCount] = await Promise.all([
      ContactMessage.countDocuments(),
      ContactMessage.countDocuments({ status: 'new' }),
      ContactMessage.countDocuments({ status: 'read' }),
      ContactMessage.countDocuments({ status: 'replied' }),
    ]);
    return res.json({ data: { total, new: newCount, read: readCount, replied: repliedCount } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/contact/:id  — admin, delete a message
// ─────────────────────────────────────────────────────────────────────────────
exports.adminDelete = async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Message not found' });
    return res.json({ message: 'Message deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete message' });
  }
};