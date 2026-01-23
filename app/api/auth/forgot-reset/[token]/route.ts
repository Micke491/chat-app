import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { emailService } from '@/lib/emailService';

// GET: Verify Token Validity (Used when the user first clicks the link)
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await props.params;

    // Re-hash the token from URL to compare with DB
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: new Date() }, // Check if not expired
    });

    if (!user) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true, email: user.email });
  } catch (error) {
    console.error('Verify Token Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Execute Password Reset
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await props.params;
    
    const body = await req.json();
    const newPassword = String(body.newPassword);

    // 1. Validation
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Clear reset fields so the token cannot be reused
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    emailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Successful',
      html: emailService.generatePasswordResetSuccessEmail(user.username || "User"),
    }).catch(err => console.error("Failed to send success email:", err));

    return NextResponse.json({ message: 'Password reset successful' });

  } catch (error) {
    console.error("Reset Password Error:", error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}