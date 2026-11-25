// Vercel Serverless Function: Real Meta WhatsApp Business Cloud API Sender
// Endpoint: POST /api/whatsapp
// Required Vercel Environment Variables:
//   WHATSAPP_TOKEN            - Meta Cloud API Permanent Access Token
//   WHATSAPP_PHONE_NUMBER_ID  - Meta WhatsApp Business Phone Number ID
//   ONEFARM_ADMIN_PHONE       - Optional (defaults to 918368289737)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const adminPhone = (process.env.ONEFARM_ADMIN_PHONE || '918368289737').replace(/[^\d]/g, '');

  const body = req.body || {};
  const { action = 'onboard', farmerPhone, name = 'Farmer', farmerId = 'OF-AS-205', state = 'Assam', dist = 'Karbi Anglong', crop = 'Karbi Anglong Ginger', volume = '1.2', floorPrice = '63', lang = 'Assamese + English', windowStr = 'Nov-Dec 2026' } = body;

  const cleanFarmerPhone = String(farmerPhone || '').replace(/[^\d]/g, '');
  const normalizedFarmer = cleanFarmerPhone.length === 10 ? '91' + cleanFarmerPhone : cleanFarmerPhone;

  // Build clean ASCII-safe message (zero emoji encoding glitches)
  let textPayload = '';
  if (action === 'monday_signal') {
    textPayload = [
      `[OneFarm Monday Signal - ${crop}]`,
      `Hello ${name} (${farmerId}),`,
      `1. Local Middleman Rate: Rs.60/kg`,
      `2. Export Reference: Rs.85/kg fresh | Rs.680/kg powder`,
      `3. Direct NERAMAC / Buyer Target: Rs.${floorPrice}/kg`,
      ``,
      `Reply YES to join this week's 20-50t graded lot (48-hr village pickup).`,
      `Reply STORAGE for zero-rot curing steps.`
    ].join('\n');
  } else if (action === 'buyer_inquiry') {
    textPayload = [
      `[OneFarm Direct Lot Inquiry - ${farmerId}]`,
      `Name: ${name}`,
      `Region: ${state}`,
      `Produce: ${crop}`,
      `Volume: ${volume} (${windowStr})`,
      `Contact: ${farmerPhone || 'N/A'}`
    ].join('\n');
  } else {
    textPayload = [
      `[OneFarm Farmer Onboarding Confirmed]`,
      `Farmer ID: ${farmerId}`,
      `Name: ${name}`,
      `Cluster: ${dist}, ${state}`,
      `Crop: ${crop}`,
      `Expected Harvest: ${volume} Tonnes (${windowStr})`,
      `Direct Buyer / NERAMAC Reference: Rs.${floorPrice}/kg`,
      `Language: ${lang}`,
      ``,
      `Your private 1-on-1 Monday Price Signal & 48-Hr Village Grading support are now active.`
    ].join('\n');
  }

  const fallbackUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(textPayload)}`;

  // If Meta WhatsApp Cloud API credentials are not configured yet, return graceful fallback
  if (!token || !phoneNumberId) {
    return res.status(200).json({
      ok: false,
      mode: 'fallback_wa_me',
      message: 'Meta WhatsApp Cloud API env vars not configured yet. Using direct WhatsApp handoff.',
      fallbackUrl,
      preview: textPayload
    });
  }

  try {
    const targetRecipient = (action === 'buyer_inquiry' || !normalizedFarmer) ? adminPhone : normalizedFarmer;

    // Send interactive 1-on-1 message via Meta Graph API v21.0
    const metaBody = action === 'monday_signal'
      ? {
          messaging_product: 'whatsapp',
          to: targetRecipient,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: textPayload },
            action: {
              buttons: [
                { type: 'reply', reply: { id: `LOCK_${farmerId}`, title: 'YES - Join Lot' } },
                { type: 'reply', reply: { id: `ROT_${farmerId}`, title: 'Storage Advisory' } }
              ]
            }
          }
        }
      : {
          messaging_product: 'whatsapp',
          to: targetRecipient,
          type: 'text',
          text: { preview_url: false, body: textPayload }
        };

    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaBody)
    });

    const metaJson = await metaRes.json();
    if (!metaRes.ok) {
      return res.status(200).json({
        ok: false,
        mode: 'meta_api_error',
        error: metaJson?.error?.message || 'Meta API rejected request',
        fallbackUrl
      });
    }

    return res.status(200).json({
      ok: true,
      mode: 'meta_cloud_api_live',
      messageId: metaJson?.messages?.[0]?.id || null,
      recipient: targetRecipient
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      mode: 'network_fallback',
      error: err.message,
      fallbackUrl
    });
  }
}
