// routes/checkout.js

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
require('dotenv').config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const { name, email, phone, tickets, competition } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: competition.match,
              description: `Entry to win: ${competition.match}`,
            },
            unit_amount: Math.round(competition.price * 100), // convert to pence
          },
          quantity: tickets.length,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:5173/success',
      cancel_url: 'http://localhost:5173/cancel',
      customer_email: email,
      metadata: {
        name,
        phone,
        ticketNumbers: tickets.join(','),
        competitionId: competition._id,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

module.exports = router;


