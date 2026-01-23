import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { emailService } from '@/lib/emailService';

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const email = String(body.email); // Cast to string

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Standard security message (Blind return)
    const blindMessage = 'If an account with that email exists, a password reset link has been sent.';

    if (!user) {
      return NextResponse.json({ message: blindMessage });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        console.error("NEXT_PUBLIC_APP_URL is not defined");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Send the UN-HASHED token to the user
    const resetURL = `${appUrl}/reset-password/${resetToken}`;

    try {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Password Reset Request',
          html: emailService.generatePasswordResetEmail(resetURL, user.username || "User"),
        });
    } catch (emailError) {
        // If email fails, rollback the DB change so the user isn't stuck with a token they never received
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        console.error('Failed to send password reset email', emailError);
        return NextResponse.json(
          { error: 'Failed to send email. Please try again later.' },
          { status: 500 }
        );
    }

    return NextResponse.json({ message: blindMessage });

  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}