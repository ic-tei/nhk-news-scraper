const puppeteer = require('puppeteer');
const fs = require('fs');
const archiver = require('archiver');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

(async () => {
  try {
    console.log("📥 ニュース取得スクリプト開始");

    const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
    const page = await browser.newPage();

    // 日付取得
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const url = `https://www3.nhk.or.jp/news/html/${dateStr}/`;

    console.log("🌐 アクセス中: " + url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

    const links = await page.$$eval('a', as => as.map(a => a.href).filter(href => href.includes('/news/html/')));

    let articles = [];

    for (let link of links.slice(0, 5)) {
      try {
        const articlePage = await browser.newPage();
        await articlePage.goto(link, { waitUntil: 'domcontentloaded', timeout: 0 });

        const title = await articlePage.$eval('h1', el => el.innerText.trim());
        const body = await articlePage.$$eval('p', ps => ps.map(p => p.innerText.trim()).join(' '));

        if (title && body) {
          articles.push({ title, body });
        }

        await articlePage.close();
      } catch (e) {
        console.log("⚠️ 記事スキップ: " + link);
      }
    }

    await browser.close();

    const simpleText = articles.map((a, i) =>
      `■ ${i + 1}. ${a.title}\n${a.body.slice(0, 100)}...`
    ).join('\n\n');

    fs.writeFileSync('news.txt', simpleText, 'utf-8');

    // ZIP生成
    const output = fs.createWriteStream('news.zip');
    const archive = archiver('zip');
    archive.pipe(output);
    archive.file('news.txt', { name: 'news.txt' });
    await archive.finalize();

    // Google Drive 認証（GitHub Secrets経由）
    const auth = new google.auth.JWT(
      process.env.GCP_CLIENT_EMAIL,
      null,
      process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.create({
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

    console.log("✅ アップロード完了: " + res.data.id);

    // メール通知
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"KidsNews" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_TO,
      subject: "ニュースZIPをアップロードしました",
      text: `Google Drive に ${dateStr} の ZIP ファイルをアップしました。`,
    });

    console.log("📨 メール通知完了");

  } catch (e) {
    console.error("❌ エラー発生:", e);
    process.exit(1);
  }
})();
