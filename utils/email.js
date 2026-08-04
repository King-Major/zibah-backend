const { Resend } = require('resend');
require('dotenv').config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const getFromAddress = () => {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || 'onboarding@resend.dev';
};

const sendBrandEmail = async (to, subject, htmlContent) => {
  if (!resend) {
    const missingMessage = 'RESEND_API_KEY is not configured. Set it in your environment before sending emails.';
    console.error(`❌ ${missingMessage}`);
    throw new Error(missingMessage);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `"ZIBAH STORES" <${getFromAddress()}>`,
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      throw new Error(error.message || 'Resend failed to send email');
    }

    console.log(`Email sent successfully to ${to}: ${data?.id}`);
    return data;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw error;
  }
};

module.exports = sendBrandEmail;