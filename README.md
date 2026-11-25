# Dung Spa — Website Đặt Lịch 2 Cơ Sở (Chạy Local + Telegram Miễn Phí + Gmail)

## 1. Cài đặt nhanh (3 bước)
1. Cài **Node.js** (bản LTS từ nodejs.org).
2. Mở Terminal / Command Prompt tại thư mục này và chạy:
   ```bash
   npm install
   ```
3. Sao chép file `.env.example` thành `.env`, điền thông tin Telegram & Gmail rồi chạy:
   ```bash
   npm start
   ```
   Sau đó mở trình duyệt vào: **http://localhost:3000**

## 2. Cách lấy Telegram Bot miễn phí báo cho chủ spa
1. Mở Telegram, tìm **@BotFather** → gõ `/newbot` → đặt tên bot (ví dụ `DungSpaBot`) → nhận `TELEGRAM_BOT_TOKEN` dán vào file `.env`.
2. Nhắn tin bất kỳ vào bot vừa tạo, rồi mở trình duyệt truy cập `https://api.telegram.org/bot<TOKEN_CUA_BAN>/getUpdates` để lấy `chat.id` dán vào `TELEGRAM_CHAT_ID_OWNER`.
3. Tương tự có thể điền `TELEGRAM_CHAT_ID_CS1` (cho Đào Thị Đinh Lăng) và `TELEGRAM_CHAT_ID_CS2` (cho Nguyễn Thị Dung) để tin nhắn tự động tách đúng cơ sở.

## 3. Cách gửi Gmail xác nhận miễn phí cho khách
1. Vào Tài khoản Google → Bảo mật → Bật **Xác minh 2 bước**.
2. Tìm mục **Mật khẩu ứng dụng (App Passwords)** → Tạo mật khẩu 16 ký tự và dán vào `GMAIL_APP_PASSWORD` trong file `.env`.

## 4. Dùng trên điện thoại (cùng mạng Wi-Fi)
Chạy `npm start`, tìm địa chỉ IP máy tính (ví dụ `192.168.1.10`), rồi mở `http://192.168.1.10:3000` trên điện thoại.

## 5. Chạy không cần server (GitHub Pages)
Thư mục `public/` là website tĩnh. Khi không có server, lịch hẹn chỉ lưu trên trình duyệt của người đặt và **chủ spa không nhận được thông báo**. Muốn nhận Telegram/Gmail cần chạy `server.js` ở máy hoặc dịch vụ hosting Node.js.

## 6. Trang chủ tiệm
Mở `/#quan-ly` (có link nhỏ "Dành cho chủ tiệm" ở cuối trang).
