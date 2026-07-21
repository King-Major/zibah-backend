const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendBrandEmail = async (to, subject, innerHtml) => {
  // Wrapping the email in the ZIBAH STORES aesthetic
  const htmlContent = `
    <div style="font-family: 'Inter', sans-serif; background-color: #ECF0F3; padding: 40px 20px; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background-color: #002366; padding: 30px; text-align: center;">
          <h1 style="font-family: 'Montserrat', sans-serif; color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">
            ZIBAH <span style="color: #FACF53;">STORES</span>
          </h1>
          <p style="color: #FACF53; font-size: 12px; margin-top: 5px; letter-spacing: 2px; text-transform: uppercase;">Life Just Got Easier</p>
        </div>

        <!-- Body -->
        <div style="padding: 40px 30px; line-height: 1.7;">
          ${innerHtml}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
          <p style="font-size: 12px; color: #888888; margin: 0;">
            Inspiring leadership. Cultivating excellence.<br/>
            &copy; ${new Date().getFullYear()} ZIBAH Lumina. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ZIBAH STORES" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`✅ Email successfully sent to ${to}`);
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
  }
};

module.exports = sendBrandEmail;