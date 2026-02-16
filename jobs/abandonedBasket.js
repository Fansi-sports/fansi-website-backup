// jobs/abandonedBasket.js
const cron = require("node-cron");
const SavedBasket = require("../models/SavedBasket");
const { sendAbandonedCartEmail } = require("../services/emailService");

function startAbandonedBasketJob() {
  // Runs every hour
  cron.schedule("0 * * * *", async () => {
    console.log("Running abandoned basket check...");

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const abandonedBaskets = await SavedBasket.find({
        savedAt: { $lt: twentyFourHoursAgo },
        checkedOut: false,
        reminderSent: false,
        items: { $exists: true, $not: { $size: 0 } },
      });

      console.log("Found " + abandonedBaskets.length + " abandoned basket(s)");

      for (const basket of abandonedBaskets) {
        try {
          await sendAbandonedCartEmail({
            to: basket.email,
            firstName: basket.firstName || "there",
            basketItems: basket.items,
          });

          await SavedBasket.findOneAndUpdate(
            { userId: basket.userId },
            {
              reminderSent: true,
              reminderSentAt: new Date(),
            }
          );

          console.log("Abandoned basket email sent to: " + basket.email);
        } catch (err) {
          console.error("Failed to send abandoned basket email to " + basket.email, err);
        }
      }
    } catch (err) {
      console.error("Abandoned basket job error:", err);
    }
  });

  console.log("Abandoned basket job scheduled (runs every hour)");
}

module.exports = { startAbandonedBasketJob };