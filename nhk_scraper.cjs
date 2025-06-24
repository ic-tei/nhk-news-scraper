const puppeteer = require('puppeteer');
const fs = require('fs');
const archiver = require('archiver');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

(async () => {
  try {
    console.log("📘 ニュース取得スクリプト開始");

    const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
    const page = await browser.newPage();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const url = `https://www3.nhk.or.jp/news/html/${dateStr}/`;

    console.log("🌐 アクセス中: " + url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

    const news = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/news/html/"]')).slice(0, 5).map(a => {
        const title = a.textContent.trim();
        const href = a.getAttribute('href');
        return title && href ? { title, url: 'https://www3.nhk.or.jp' + href } : null;
      }).filter(n => n);
    });

    const text = news.map(n => `■ ${n.title}
${n.url}`).join("\n\n");
    fs.writeFileSync('news.txt', text, 'utf8');
    console.log("📝 ニュース保存完了");

    const output = fs.createWriteStream('news.zip');
    const archive = archiver('zip');
    archive.pipe(output);
    archive.file('news.txt', { name: 'news.txt' });
    await archive.finalize();

    console.log("✅ ZIP作成完了");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY.replace(/\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });
    await drive.files.create({
      requestBody: {
        name: `news_${dateStr}.zip`,
        parents: [process.env.GDRIVE_FOLDER_ID],
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: fs.createReadStream('news.zip'),
      },
    });

    console.log("🚀 Google Driveにアップロード成功");

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      }
    });

    await transporter.sendMail({
      from: `"NHKニュース" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_TO,
      subject: "今日のNHKニュースをアップロードしました",
      text: `Google Driveにnews_${dateStr}.zip をアップロードしました。`,
    });

    console.log("📩 メール通知送信完了");

    await browser.close();
  } catch (err) {
    console.error("❌ エラー発生:", err);
  }
})();
