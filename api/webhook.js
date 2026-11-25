// Vercel Serverless Function: Meta WhatsApp Business Webhook
// Endpoint: GET & POST /api/webhook
// Required Vercel Env Vars:
//   WHATSAPP_VERIFY_TOKEN     - Set to "onefarm_verify_4488" in Meta Developer Console & Vercel
//   WHATSAPP_TOKEN            - Meta Cloud API Permanent Access Token
//   WHATSAPP_PHONE_NUMBER_ID  - Meta WhatsApp Business Phone Number ID

export default async function handler(req, res) {
  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'onefarm_verify_4488';

    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  // 2. Incoming Farmer WhatsApp Replies (POST)
  if (req.method === 'POST') {
    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const msg = change?.messages?.[0];

      if (!msg) return res.status(200).json({ ok: true, ignored: true });

      const from = msg.from;
      const text = (msg.text?.body || msg.interactive?.button_reply?.title || '').trim();
      const buttonId = msg.interactive?.button_reply?.id || '';

      let replyText = '';
      if (/^yes|lock/i.test(text) || buttonId.startsWith('LOCK_')) {
        replyText = [
          `[OneFarm Lot Confirmation]`,
          `Confirmed! Your harvest is now pooled into this week's 20-50t graded NERAMAC / Export lot.`,
          `• 48-Hr Village Grading Agent assigned`,
          `• Ventilated mesh crates scheduled`,
          `• Direct farmer-to-buyer settlement (zero middleman)`
        ].join('\n');
      } else if (/storage|rot|cure/i.test(text) || buttonId.startsWith('ROT_')) {
        replyText = [
          `[OneFarm Zero-Rot Advisory (30% -> 8%)]`,
          `1. Stop irrigation 14-21 days before lifting ginger.`,
          `2. Cure rhizomes in ventilated shade for 48 hours.`,
          `3. Never pack in plastic sacks - use OneFarm breathable mesh crates.`
        ].join('\n');
      } else if (/price|rate|mandi/i.test(text)) {
        replyText = [
          `[OneFarm Live Price Signal]`,
          `Karbi Anglong Ginger: Mandi Rs.60/kg | Export Powder Rs.680/kg | Direct Lot Target Rs.63-70/kg.`,
          `Queen Pineapple: Mandi Rs.8/kg | Direct FOB Export Rs.115/kg.`,
          `Reply YES to join this week's graded lot.`
        ].join('\n');
      } else {
        replyText = [
          `Namaskar from OneFarm!`,
          `Reply PRICE for Monday's 3-number market signal, YES to join a 20-50t graded lot, or STORAGE for rot-prevention steps.`
        ].join('\n');
      }

      const apiToken = process.env.WHATSAPP_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (apiToken && phoneId && from) {
        await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: from,
            type: 'text',
            text: { body: replyText }
          })
        });
      }

      return res.status(200).json({ ok: true, repliedTo: from });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).end();
}
