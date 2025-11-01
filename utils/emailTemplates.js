export const otpTemplate = (name, otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Your One-Time Password</title>
  <style>
    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      background-color: #f2f4f6;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .content {
      padding: 40px;
    }
    .header {
      background-color: #007bff;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .footer {
      background-color: #f2f4f6;
      color: #888888;
      padding: 20px;
      text-align: center;
      font-size: 12px;
    }
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .content {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f2f4f6;">
  <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    Here is your OTP for password reset.
  </span>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f2f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table class="container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          
          <tr>
            <td align="center" style="padding: 30px 0; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);">
              <img src="https://your-logo-url.com/logo.png" alt="Company Logo" width="150" style="display: block;">
            </td>
          </tr>

          <tr>
            <td class="content" style="padding: 40px; color: #333333; font-size: 16px; line-height: 1.6;">
              <h2 style="color: #0056b3; margin-top: 0; font-weight: 600;">Password Reset Request</h2>
              <p>Hi <strong>${name}</strong>,</p>
              <p>We received a request to reset your password. Please use the One-Time Password (OTP) below to complete the process. This code is valid for <strong>10 minutes</strong>.</p>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <div style="background: linear-gradient(135deg, #f0f8ff 0%, #e6efff 100%); border-radius: 8px; padding: 20px 30px; display: inline-block; border: 1px solid #cce0ff;">
                      <span style="font-size: 36px; font-weight: bold; color: #0056b3; letter-spacing: 4px; line-height: 1;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color: #555555;">If you did not request a password reset, please ignore this email or contact our support team if you have any concerns.</p>
              <p>Thank you,<br>The Auth System Team</p>
            </td>
          </tr>

          <tr>
            <td class="footer" style="background-color: #f2f4f6; color: #888888; padding: 20px; text-align: center; font-size: 12px;">
              <p>You received this email because a password reset was requested for your account.</p>
              <p>Auth System &copy; ${new Date().getFullYear()}. 123 Main Street, Anytown, USA</p>
              <p><a href="#" style="color: #007bff; text-decoration: none;">Unsubscribe</a> | <a href="#" style="color: #007bff; text-decoration: none;">Help Center</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;