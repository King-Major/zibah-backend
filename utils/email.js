const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for port 465
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
  // 🚀 THE MAGIC FIX FOR RENDER
  // Forces Node to use IPv4 instead of IPv6, bypassing the ENETUNREACH error
  family: 4 
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