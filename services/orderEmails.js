const Vendor = require('../models/Vendor');
const sendBrandEmail = require('../utils/email');
const { escapeHtml } = require('../utils/helpers');

/**
 * Sends (1) download links to the customer for digital items and
 * (2) ONE fulfilment email per vendor for their items.
 * Never throws – email problems must not break the payment flow.
 */
const processPostPaymentEmails = async (order, customerEmail) => {
  try {
    const items = order.items || [];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // 1. Digital goods → customer
    const digitalItems = items.filter((item) => item.isDigital);

    if (digitalItems.length > 0 && customerEmail) {
      let digitalHtml = `
        <h2 style="font-family: 'Montserrat', sans-serif; color: #002366;">Your Digital Downloads Are Ready!</h2>
        <p>Thank you for your purchase. You can access your digital products using the secure links below:</p>
        <ul style="list-style-type: none; padding: 0;">
      `;

      digitalItems.forEach((item) => {
        // TODO: replace with a signed, expiring link to the actual file (e.g. Cloudinary/S3 signed URL)
        digitalHtml += `
          <li style="margin-bottom: 15px; padding: 15px; border: 1px solid #eee; border-radius: 5px;">
            <strong>${escapeHtml(item.name)}</strong><br/>
            <a href="${frontendUrl}/download/${order._id}" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background-color: #FACF53; color: #002366; text-decoration: none; font-weight: bold; border-radius: 5px;">Download Now</a>
          </li>
        `;
      });
      digitalHtml += `</ul><p>If you have any issues, reply to this email and our support team will assist you.</p>`;

      try {
        await sendBrandEmail(customerEmail, 'Your ZIBAH STORES Digital Downloads', digitalHtml);
      } catch (err) {
        console.error('Digital download email failed:', err.message);
      }
    }

    // 2. Group items by vendor so each vendor gets ONE email
    const vendorIds = [...new Set(items.filter((i) => i.vendor).map((i) => String(i.vendor)))];
    if (vendorIds.length === 0) return;

    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
    const pickup = order.locationSnapshot || {};

    // Sequential on purpose: Resend rate-limits bursts of requests
    for (const vendor of vendors) {
      const vendorItems = items.filter((i) => String(i.vendor) === String(vendor._id));

      let vendorHtml = `
        <h2 style="font-family: 'Montserrat', sans-serif; color: #002366;">New Order Received!</h2>
        <p>Hello ${escapeHtml(vendor.name)},</p>
        <p>You have a new order to fulfill via ZIBAH STORES (ref: <strong>${escapeHtml(order.paystackRef)}</strong>). Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #002366; color: white;">
            <th style="padding: 10px; text-align: left;">Product</th>
            <th style="padding: 10px; text-align: center;">Quantity</th>
          </tr>
      `;

      vendorItems.forEach((p) => {
        vendorHtml += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${escapeHtml(p.name)}</td>
            <td style="padding: 10px; text-align: center;">${p.quantity}</td>
          </tr>
        `;
      });

      vendorHtml += `
        </table>
        <p style="margin-top: 20px;">Please prepare these items for dispatch to the selected pickup location${
          pickup.name ? `: <strong>${escapeHtml(pickup.name)}</strong>${pickup.address ? ` (${escapeHtml(pickup.address)})` : ''}` : ''
        }.</p>
      `;

      try {
        await sendBrandEmail(vendor.email, 'New Order Fulfillment - ZIBAH STORES', vendorHtml);
      } catch (err) {
        console.error(`Vendor email to ${vendor.email} failed:`, err.message);
      }
    }
  } catch (error) {
    console.error('Error processing post-payment emails:', error);
  }
};

module.exports = { processPostPaymentEmails };
