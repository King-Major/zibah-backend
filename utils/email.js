const nodemailer = require('nodemailer');
require('dotenv').config();

// Using the native 'gmail' service allows Nodemailer to handle all the 
// complex TLS/SSL handshakes automatically, preventing port timeouts.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  }
});

const sendBrandEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: `"ZIBAH STORES" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw error; 
  }
};

module.exports = sendBrandEmail;