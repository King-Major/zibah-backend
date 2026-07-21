const db = require('../db');
const sendBrandEmail = require('../utils/email');

const processPostPaymentEmails = async (orderId, customerEmail) => {
  try {
    // 1. Fetch all items from this order, joining product and vendor details
    const query = `
      SELECT oi.quantity, oi.price_at_purchase, p.name as product_name, p.is_digital, v.email as vendor_email, v.name as vendor_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN vendors v ON oi.vendor_id = v.id
      WHERE oi.order_id = $1
    `;
    const result = await db.query(query, [orderId]);
    const items = result.rows;

    // 2. Filter Digital Goods for the Customer
    const digitalItems = items.filter(item => item.is_digital);
    
    if (digitalItems.length > 0) {
      let digitalHtml = `
        <h2 style="font-family: 'Montserrat', sans-serif; color: #002366;">Your Digital Downloads Are Ready!</h2>
        <p>Thank you for your purchase. You can access your digital products using the secure links below:</p>
        <ul style="list-style-type: none; padding: 0;">
      `;
      
      digitalItems.forEach(item => {
        // In a production environment, you would generate a secure, expiring AWS S3 link here. 
        // For now, we simulate the link.
        digitalHtml += `
          <li style="margin-bottom: 15px; padding: 15px; border: 1px solid #eee; border-radius: 5px;">
            <strong>${item.product_name}</strong><br/>
            <a href="https://zibahstores.com/download/${orderId}" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background-color: #FACF53; color: #002366; text-decoration: none; font-weight: bold; border-radius: 5px;">Download Now</a>
          </li>
        `;
      });
      digitalHtml += `</ul><p>If you have any issues, reply to this email and our support team will assist you.</p>`;
      
      await sendBrandEmail(customerEmail, 'Your ZIBAH STORES Digital Downloads', digitalHtml);
    }

    // 3. Group Physical/Vendor Items and Alert Vendors
    // We group by vendor_email so a vendor gets ONE email even if multiple of their products were bought.
    const vendorGroups = {};
    
    items.forEach(item => {
      if (item.vendor_email) {
        if (!vendorGroups[item.vendor_email]) {
          vendorGroups[item.vendor_email] = { name: item.vendor_name, products: [] };
        }
        vendorGroups[item.vendor_email].products.push(item);
      }
    });

    for (const [vEmail, vData] of Object.entries(vendorGroups)) {
      let vendorHtml = `
        <h2 style="font-family: 'Montserrat', sans-serif; color: #002366;">New Order Received!</h2>
        <p>Hello ${vData.name},</p>
        <p>You have a new order to fulfill via ZIBAH STORES. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #002366; color: white;">
            <th style="padding: 10px; text-align: left;">Product</th>
            <th style="padding: 10px; text-align: center;">Quantity</th>
          </tr>
      `;

      vData.products.forEach(p => {
        vendorHtml += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${p.product_name}</td>
            <td style="padding: 10px; text-align: center;">${p.quantity}</td>
          </tr>
        `;
      });

      vendorHtml += `
        </table>
        <p style="margin-top: 20px;">Please prepare these items for dispatch to the selected pickup location.</p>
      `;

      await sendBrandEmail(vEmail, 'New Order Fulfillment - ZIBAH STORES', vendorHtml);
    }

  } catch (error) {
    console.error('Error processing post-payment emails:', error);
  }
};

module.exports = { processPostPaymentEmails };