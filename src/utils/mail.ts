import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_SERVER,
  port: Number(process.env.MAIL_PORT),
  secure: process.env.MAIL_SSL_TLS === 'True' || process.env.MAIL_PORT === '465',
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: {
    // If VALIDATE_CERTS is False, we ignore unauthorized certs. Otherwise we reject them.
    rejectUnauthorized: process.env.VALIDATE_CERTS !== 'False',
  },
});

export async function sendOtpEmail(email: string, otp: string) {
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
    to: email,
    subject: 'Your Verification Code',
    text: `Your verification code is: ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: auto;">
        <h2 style="color: #333;">Verification Code</h2>
        <p>Use the following code to sign in to your account:</p>
        <div style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 5px; margin: 20px 0;">${otp}</div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}
