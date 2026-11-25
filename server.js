require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readDB() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { bookings: [], notifications: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function timeToMinutes(t) {
  if (!t || !t.includes(':')) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Loi gui Telegram:', err.message);
  }
}

async function sendCustomerGmail(booking) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass || !booking.email) return;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: `"Dung Spa" <${user}>`,
      to: booking.email,
      subject: `[Dung Spa] Xác nhận đặt lịch thành công #${esc(booking.id)}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:20px;border:1px solid #f3d0da;border-radius:12px;">
          <h2 style="color:#9f1239;margin-top:0;">Dung Spa — Xác nhận lịch hẹn</h2>
          <p>Xin chào <b>${esc(booking.customerName)}</b>,</p>
          <p>Bạn đã đặt lịch thành công tại <b>${esc(booking.branchLabel)}</b>:</p>
          <ul>
            <li><b>Dịch vụ:</b> ${esc(booking.serviceName)}</li>
            <li><b>Chuyên viên:</b> ${esc(booking.staffName)}</li>
            <li><b>Thời gian:</b> ${esc(booking.time)} ngày ${esc(booking.date)}</li>
            <li><b>Mã đơn:</b> #${esc(booking.id)}</li>
          </ul>
          <p>Cảm ơn bạn đã tin tưởng Dung Spa!</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Loi gui Gmail:', err.message);
  }
}

// API: Lay danh sach lich hen
app.get('/api/state', (req, res) => {
  res.json(readDB());
});

// API: Tao lich hen moi + Kiem tra toi da 2 khach / 60 phut + Gui Telegram & Gmail
app.post('/api/bookings', async (req, res) => {
  const booking = req.body;
  if (!booking || !booking.branchId || !booking.date || !booking.time) {
    return res.status(400).json({ error: 'Thieu thong tin dat lich' });
  }

  const db = readDB();
  const targetMin = timeToMinutes(booking.time);
  const overlapping = db.bookings.filter((bk) => {
    if (bk.branchId !== booking.branchId || bk.date !== booking.date || bk.status === 'cancelled') return false;
    return Math.abs(timeToMinutes(bk.time) - targetMin) < 60;
  });

  if (overlapping.length >= 2) {
    return res.status(409).json({ error: 'Đã có khách hẹn lịch này / Lịch bận (đã đủ 2 khách cùng thời điểm).' });
  }

  db.bookings.push(booking);
  const notifText = `${booking.branchLabel} (${booking.staffName}): Khách ${booking.customerName} (${booking.phone}) đặt ${booking.serviceName} lúc ${booking.time} ngày ${booking.date}.`;
  db.notifications.push({
    id: 'n_' + Date.now(),
    branchId: booking.branchId,
    text: notifText,
    time: new Date().toTimeString().slice(0, 5)
  });
  writeDB(db);

  // Gui Telegram mien phi cho chu tiem & co so tuong ung
  const tgMsg = `<b>🔔 LỊCH HẸN MỚI - DUNG SPA</b>\n` +
    `📍 <b>${esc(booking.branchLabel)}</b> (${esc(booking.staffName)})\n` +
    `👤 Khách: ${esc(booking.customerName)}\n` +
    `📞 SĐT: ${esc(booking.phone)}\n` +
    `📧 Gmail: ${esc(booking.email)}\n` +
    `💆 Dịch vụ: ${esc(booking.serviceName)}\n` +
    `⏰ Thời gian: <b>${esc(booking.time)} · ${esc(booking.date)}</b>` +
    (booking.note ? `\n📝 Ghi chú: ${esc(booking.note)}` : '');

  await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID_OWNER, tgMsg);
  if (booking.branchId === 'branch_a') {
    await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID_CS1, tgMsg);
  } else {
    await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID_CS2, tgMsg);
  }

  // Gui Gmail cho khach neu co chon gmail/both
  if (booking.notifyChannel === 'gmail' || booking.notifyChannel === 'both') {
    await sendCustomerGmail(booking);
  }

  res.json({ ok: true, booking });
});

// API: Cap nhat trang thai (hoan thanh / huy)
app.patch('/api/bookings/:id', (req, res) => {
  const db = readDB();
  const item = db.bookings.find((b) => b.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Khong tim thay don' });
  item.status = req.body.status || item.status;
  writeDB(db);
  res.json({ ok: true, booking: item });
});

app.listen(PORT, () => {
  console.log(`Dung Spa dang chay tai: http://localhost:${PORT}`);
});
