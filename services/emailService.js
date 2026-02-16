// services/emailService.js
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FANSI_PURPLE = '#332c54';
const FANSI_RED = '#ff5757';
const FANSI_WHITE = '#fdfbfb';

function wrapEmailHTML(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: ${FANSI_WHITE}; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${FANSI_PURPLE}; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: ${FANSI_WHITE}; font-size: 32px; font-weight: 700; letter-spacing: 2px;">FANSI</h1>
              <p style="margin: 8px 0 0; color: ${FANSI_WHITE}; font-size: 14px; opacity: 0.9;">Sports Competitions</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px; text-align: center;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>Fansi Sports</strong><br>
                Your gateway to VIP sports experiences
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                <a href="https://fansisports.co.uk" style="color: ${FANSI_PURPLE}; text-decoration: none;">Visit Website</a>
                &nbsp;•&nbsp;
                <a href="https://fansisports.co.uk/terms" style="color: ${FANSI_PURPLE}; text-decoration: none;">Terms</a>
                &nbsp;•&nbsp;
                <a href="https://fansisports.co.uk/contact" style="color: ${FANSI_PURPLE}; text-decoration: none;">Contact</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// 1. WELCOME EMAIL
async function sendWelcomeEmail({ to, firstName }) {
  const content = `
    <h2 style="margin: 0 0 20px; color: ${FANSI_PURPLE}; font-size: 24px; text-align: center;">Welcome to Fansi, ${firstName}! 🎉</h2>
    
    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
      Thank you for joining Fansi Sports! Your account has been successfully created.
    </p>
    
    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
      You can now enter draws to win incredible VIP hospitality experiences at top sporting events. 
      From Premier League matches to Rugby finals, we've got it all.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://fansisports.co.uk/competitions" 
         style="display: inline-block; padding: 14px 32px; background-color: ${FANSI_RED}; color: ${FANSI_WHITE}; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">
        Browse Competitions
      </a>
    </div>
    
    <p style="margin: 20px 0 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
      If you have any questions, feel free to reach out to us at 
      <a href="mailto:info@fansisports.co.uk" style="color: ${FANSI_PURPLE};">info@fansisports.co.uk</a>
    </p>
  `;

  try {
    const result = await resend.emails.send({
      from: 'Fansi Sports <info@fansisports.co.uk>',
      to: [to],
      subject: 'Welcome to Fansi Sports! 🎟️',
      html: wrapEmailHTML(content),
    });
    console.log('✅ Welcome email sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Welcome email failed:', error);
    throw error;
  }
}

// 2. ORDER CONFIRMATION EMAIL
async function sendOrderConfirmationEmail({ to, firstName, order }) {
  const orderDate = new Date(order.createdAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalAmount = (order.amountTotal / 100).toFixed(2);

  const itemsHTML = order.items.map(item => {
    const ticketsHTML = item.tickets && item.tickets.length > 0
      ? `
        <div style="margin-top: 8px;">
          <strong style="color: ${FANSI_PURPLE};">Your Tickets:</strong>
          <div style="margin-top: 4px;">
            ${item.tickets.map(num => `
              <span style="display: inline-block; background-color: ${FANSI_RED}; color: ${FANSI_WHITE}; padding: 4px 12px; border-radius: 4px; margin: 4px 4px 0 0; font-weight: 600; font-size: 14px;">
                #${Number(num).toLocaleString()}
              </span>
            `).join('')}
          </div>
        </div>
      `
      : '<p style="color: #999; font-size: 13px; margin-top: 8px;">Tickets will be allocated shortly.</p>';

    return `
      <div style="padding: 20px; background-color: #f9f9f9; border-radius: 6px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px; color: ${FANSI_PURPLE}; font-size: 18px;">${item.title}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">
          ${item.qty} ticket${item.qty > 1 ? 's' : ''} × £${(item.unitPrice / 100).toFixed(2)} each
        </p>
        ${ticketsHTML}
      </div>
    `;
  }).join('');

  const content = `
    <h2 style="margin: 0 0 20px; color: ${FANSI_PURPLE}; font-size: 24px; text-align: center;">Payment Confirmed! ✅</h2>
    
    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
      Hi ${firstName}, thank you for your order! You're now entered into the draw. Good luck! 🎟️
    </p>

    <div style="background-color: #f0f8ff; border-left: 4px solid ${FANSI_PURPLE}; padding: 16px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; color: ${FANSI_PURPLE}; font-weight: 600;">Order Date</p>
      <p style="margin: 4px 0 0; color: #333; font-size: 16px;">${orderDate}</p>
    </div>

    <h3 style="margin: 24px 0 16px; color: ${FANSI_PURPLE}; font-size: 18px; text-align: center;">Your Entries</h3>

    ${itemsHTML}

    <div style="text-align: center; padding: 20px; background-color: #f9f9f9; border-radius: 6px; margin-top: 20px;">
      <p style="margin: 0; color: #666; font-size: 14px;">Total Paid</p>
      <p style="margin: 4px 0 0; color: ${FANSI_PURPLE}; font-size: 24px; font-weight: 700;">£${totalAmount}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://fansisports.co.uk/account?tab=tickets" 
         style="display: inline-block; padding: 14px 32px; background-color: ${FANSI_RED}; color: ${FANSI_WHITE}; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">
        View My Tickets
      </a>
    </div>

    <p style="margin: 20px 0 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
      We'll be in touch if you win. Good luck from the Fansi team!
    </p>
  `;

  try {
    const result = await resend.emails.send({
      from: 'Fansi Sports <info@fansisports.co.uk>',
      to: [to],
      subject: 'Your Fansi Order Confirmation 🎟️',
      html: wrapEmailHTML(content),
    });
    console.log('✅ Order confirmation email sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Order confirmation email failed:', error);
    throw error;
  }
}

// 3. ABANDONED BASKET EMAIL
async function sendAbandonedCartEmail({ to, firstName, basketItems }) {
  const itemsHTML = basketItems.map(item => `
    <li style="margin-bottom: 12px; color: #333; font-size: 15px; text-align: center; list-style: none;">
      <strong>${item.title}</strong> — ${item.qty} ticket${item.qty > 1 ? 's' : ''}
    </li>
  `).join('');

  const content = `
    <h2 style="margin: 0 0 20px; color: ${FANSI_PURPLE}; font-size: 24px; text-align: center;">You left something behind! 🎟️</h2>

    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
      Hi ${firstName}, you added these competitions to your basket but didn't complete your order:
    </p>

    <ul style="margin: 20px 0; padding-left: 0; list-style: none;">
      ${itemsHTML}
    </ul>

    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
      Don't miss your chance to win VIP hospitality experiences! Complete your order before the draw closes.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://fansisports.co.uk/checkout" 
         style="display: inline-block; padding: 14px 32px; background-color: ${FANSI_RED}; color: ${FANSI_WHITE}; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">
        Complete Your Order
      </a>
    </div>

    <p style="margin: 20px 0 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
      Need help? Contact us at 
      <a href="mailto:info@fansisports.co.uk" style="color: ${FANSI_PURPLE};">info@fansisports.co.uk</a>
    </p>
  `;

  try {
    const result = await resend.emails.send({
      from: 'Fansi Sports <info@fansisports.co.uk>',
      to: [to],
      subject: 'Complete Your Fansi Order 🎯',
      html: wrapEmailHTML(content),
    });
    console.log('✅ Abandoned basket email sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Abandoned basket email failed:', error);
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendAbandonedCartEmail,
};