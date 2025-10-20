import express from "express";
import admin from "firebase-admin";

const app = express();

// ✅ Initialize Firebase
function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");

  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase initialized");
}

try {
  initFirebase();
} catch (err) {
  console.error("Firebase init error:", err.message);
}

const db = admin.firestore();

// 🪙 Conversion rate
const COINS_PER_USD = 5000;

// === 📩 MyLead Offerwall Postback Route ===
app.get("/api/mylead", async (req, res) => {
  try {
    if (!admin.apps.length) {
      return res.status(500).send("❌ Firebase not initialized");
    }

    // 🧾 Common MyLead parameters
    const player_id =
      req.query.subid || req.query.player_id || req.query.uid || req.query.user_id;
    const payoutUsdRaw = req.query.payout_usd || req.query.amount || req.query.value || "0";

    if (!player_id) return res.status(400).send("❌ subid (user ID) missing");

    const payoutUsd = parseFloat(payoutUsdRaw);
    if (isNaN(payoutUsd) || payoutUsd <= 0)
      return res.status(400).send("❌ Invalid payout_usd or amount");

    // 🧮 Convert USD → Coins
    const coins = Math.round(payoutUsd * COINS_PER_USD);

    // 🔥 Update user balance in Firestore
    const userRef = db.collection("users").doc(player_id);
    await userRef.set(
      { balance: admin.firestore.FieldValue.increment(coins) },
      { merge: true }
    );

    // 🪵 Log to Firestore
    await db.collection("mylead_logs").add({
      player_id,
      payout_usd: payoutUsd,
      coins,
      source: "mylead",
      raw_data: req.query,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ ${coins} coins added to ${player_id}`);
    return res
      .status(200)
      .send(`✅ ${coins} coins user ${player_id} ke wallet me credit ho gaye hain (MyLead)`);
  } catch (err) {
    console.error("Postback error:", err.message);
    return res.status(500).send("❌ Server Error");
  }
});

// 🏠 Root route check
app.get("/", (req, res) => res.send("MyLead Postback API Working ✅"));

// 🟢 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
