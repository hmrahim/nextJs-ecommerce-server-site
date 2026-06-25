// 📁 PATH: src/controllers/authController.js
// ✅ CHANGES:
//   - signupController → OTP পাঠায়, token দেয় না (verify first)
//   - verifyEmailController → OTP চেক করে, verified করে, token দেয়
//   - resendOtpController → নতুন OTP পাঠায়
//   - signinController → unverified user কে block করে
//   - signinVerifiedController → OTP verify এর পরে auto-login  ← NEW
//   - forgotPasswordController → password reset OTP পাঠায়      ← NEW
//   - resetPasswordController  → OTP verify + নতুন password সেট ← NEW
'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { sendVerificationOtp, sendPasswordResetOtp, generateOtp } = require('../services/emailService');

/* ── JWT helper ──────────────────────────────────────────────── */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const OTP_EXPIRY_MINUTES = 10;

/* ══════════════════════════════════════════════════════════════
   SIGNUP  →  OTP পাঠায়, token দেয় না
══════════════════════════════════════════════════════════════ */
exports.signupController = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    /* email already registered? */
    const existing = await User.findOne({ email });
    if (existing) {
      /* unverified হলে নতুন OTP পাঠিয়ে দাও */
      if (!existing.emailVerified) {
        const otp        = generateOtp();
        const expiry     = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        await User.findByIdAndUpdate(existing._id, {
          emailOtp:        otp,
          emailOtpExpires: expiry,
        });

        await sendVerificationOtp({
          email,
          name: existing.firstName,
          otp,
        }).catch((err) => console.error('[emailService] resend OTP failed:', err));

        return res.status(200).json({
          message:       'Email already registered but not verified. A new OTP has been sent.',
          requiresVerification: true,
          email,
        });
      }
      return res.status(400).json({ message: 'Email already registered' });
    }

    /* নতুন user তৈরি */
    const passwordHash = await bcrypt.hash(password, 10);
    const otp          = generateOtp();
    const expiry       = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      emailOtp:        otp,
      emailOtpExpires: expiry,
    });

    /* Brevo দিয়ে OTP পাঠাও */
    await sendVerificationOtp({
      email,
      name: firstName,
      otp,
    }).catch((err) => console.error('[emailService] send OTP failed:', err));

    return res.status(201).json({
      message:              'Account created! Please check your email for the verification code.',
      requiresVerification: true,
      email,
    });
  } catch (err) {
    console.error('[signupController]', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   VERIFY EMAIL  →  OTP মিলালে verified + token দেয়
══════════════════════════════════════════════════════════════ */
exports.verifyEmailController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    /* OTP field গুলো select করতে হবে (select:false আছে) */
    const user = await User.findOne({ email }).select(
      '+emailOtp +emailOtpExpires'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    /* OTP expired? */
    if (!user.emailOtpExpires || user.emailOtpExpires < new Date()) {
      return res.status(400).json({
        message: 'OTP has expired. Please request a new one.',
        expired: true,
      });
    }

    /* OTP mismatch? */
    if (user.emailOtp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    /* ✅ সব ঠিক আছে — verify করে OTP মুছে দাও */
    user.emailVerified   = true;
    user.emailOtp        = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    const token = signToken(user._id);

    return res.status(200).json({
      message: 'Email verified successfully! Welcome to Moom24.',
      token,
      user: {
        id:            user._id,
        firstName:     user.firstName,
        lastName:      user.lastName,
        email:         user.email,
        role:          user.role,
        emailVerified: true,
      },
    });
  } catch (err) {
    console.error('[verifyEmailController]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   RESEND OTP
══════════════════════════════════════════════════════════════ */
exports.resendOtpController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    /* Rate limit: শেষ OTP পাঠানোর ১ মিনিটের মধ্যে পুনরায় পাঠানো যাবে না */
    const cooldownMs = 60 * 1000;
    if (
      user.emailOtpExpires &&
      user.emailOtpExpires > new Date(Date.now() + (OTP_EXPIRY_MINUTES - 1) * 60 * 1000 - cooldownMs)
    ) {
      return res.status(429).json({
        message: 'Please wait 1 minute before requesting a new OTP.',
      });
    }

    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      emailOtp:        otp,
      emailOtpExpires: expiry,
    });

    await sendVerificationOtp({
      email,
      name: user.firstName,
      otp,
    });

    return res.status(200).json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    console.error('[resendOtpController]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   LOGIN  →  unverified user কে block করে
══════════════════════════════════════════════════════════════ */
exports.signinController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    /* ✅ Email verified চেক */
    if (!user.emailVerified) {
      const otp    = generateOtp();
      const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      await User.findByIdAndUpdate(user._id, {
        emailOtp:        otp,
        emailOtpExpires: expiry,
      });
      await sendVerificationOtp({ email, name: user.firstName, otp }).catch(
        (err) => console.error('[emailService] login-resend OTP failed:', err)
      );

      return res.status(403).json({
        message:              'Please verify your email first. A new OTP has been sent.',
        requiresVerification: true,
        email,
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id:            user._id,
        firstName:     user.firstName,
        lastName:      user.lastName,
        email:         user.email,
        role:          user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error('[signinController]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   SIGNIN VERIFIED  ← NEW
   OTP verify সফল হওয়ার পরে NextAuth auto-login এর জন্য।
   emailVerified=true থাকলেই password ছাড়া token দেয়।
══════════════════════════════════════════════════════════════ */
exports.signinVerifiedController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: 'Email not verified' });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id:            user._id,
        firstName:     user.firstName,
        lastName:      user.lastName,
        email:         user.email,
        role:          user.role,
        emailVerified: true,
      },
    });
  } catch (err) {
    console.error('[signinVerifiedController]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   FORGOT PASSWORD  ← NEW
   email দিলে reset OTP পাঠায়
══════════════════════════════════════════════════════════════ */
exports.forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    /* Security: user না পেলেও same response দাও */
    if (!user) {
      return res.status(200).json({
        message: 'If this email is registered, a reset code has been sent.',
        email,
      });
    }

    /* Rate limit: ১ মিনিটের মধ্যে আবার request করা যাবে না */
    if (
      user.passwordResetExpires &&
      user.passwordResetExpires > new Date(Date.now() + (OTP_EXPIRY_MINUTES - 1) * 60 * 1000)
    ) {
      return res.status(429).json({
        message: 'Please wait 1 minute before requesting another reset code.',
      });
    }

    const otp    = generateOtp();
    const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken:   otp,
      passwordResetExpires: expiry,
    });

    await sendPasswordResetOtp({
      email,
      name: user.firstName,
      otp,
    }).catch((err) => console.error('[emailService] reset OTP failed:', err));

    return res.status(200).json({
      message: 'If this email is registered, a reset code has been sent.',
      email,
    });
  } catch (err) {
    console.error('[forgotPasswordController]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   RESET PASSWORD  ← NEW
   OTP verify + নতুন password সেট + auto-login token
══════════════════════════════════════════════════════════════ */
exports.resetPasswordController = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }

    const user = await User.findOne({ email }).select(
      '+passwordResetToken +passwordResetExpires +passwordHash'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    /* OTP expired? */
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.status(400).json({
        message: 'Reset code has expired. Please request a new one.',
        expired: true,
      });
    }

    /* OTP mismatch? */
    if (user.passwordResetToken !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid code. Please try again.' });
    }

    /* ✅ নতুন password সেট, reset fields মুছো */
    user.passwordHash         = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const token = signToken(user._id);

    return res.status(200).json({
      message: 'Password reset successfully!',
      token,
      user: {
        id:            user._id,
        firstName:     user.firstName,
        lastName:      user.lastName,
        email:         user.email,
        role:          user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error('[resetPasswordController]', err);
    res.status(500).json({ message: 'Server error' });
  }
};