const puppeteer = require('puppeteer');
const fs = require('fs');
const archiver = require('archiver');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log("🟡 ニュース取得スクリプト開始");

(async () => {
  try {
    // 日付取得
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    // PuppeteerでNHKページへ
    const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
    const page = await browser.newPage();
    const url = `https://www3.nhk.or.jp/news/html/${dateStr}/`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

    const newsTitles = await page.$$eval('h3.title', els =>
      els.map(el => el.innerText.trim()).filter(Boolean)
    );

    await browser.close();

    // ファイル保存
    const fileName = `news_${dateStr}.txt`;
    const text = newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
    fs.writeFileSync(fileName, text);

    // ZIP圧縮
    const zipName = `news_${dateStr}.zip`;
    const output = fs.createWriteStream(zipName);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.file(fileName, { name: fileName });
    await archive.finalize();

    // Google Drive 認証
    const auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

    // Driveにアップロード
    const folderId = process.env.DRIVE_FOLDER_ID;
    const fileMetadata = {
      name: zipName,
      parents: [folderId],
    };
    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(zipName),
    };
    await drive.files.create({ resource: fileMetadata, media });

    // メール送信
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'endoh-k@edu-g.gsn.ed.jp',
      subject: `📢 ${dateStr}のニュースZIPをアップロードしました`,
      text: `Google Driveへのアップロードが完了しました。ファイル名：${zipName}`,
    });

    console.log("✅ 完了：ZIP作成・Driveアップロード・メール送信");

  } catch (e) {
    console.error("🔴 エラー発生:", e);
    process.exit(1);
  }
})();
