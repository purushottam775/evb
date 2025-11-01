import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, html) => {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass) {
      console.warn("Email configuration missing. Skipping email send.");
      console.log("Email would be sent to:", to);
      console.log("Subject:", subject);
      console.log("Content:", html);
      return;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const info = await transporter.sendMail({
      from: `"EV Charge System" <${emailUser}>`,
      to,
      subject,
      html
    });
      
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Email sending failed:", error.message);
    // Don't throw error, just log and return successfully
    // This prevents the password reset from failing due to email issues
    return Promise.resolve();
  }
};
