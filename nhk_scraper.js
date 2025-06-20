const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      headless: true
    });
    const page = await browser.newPage();

    // NHKニュース一覧ページへアクセス（6月19日を例）
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const url = `https://www3.nhk.or.jp/news/html/${dateStr}/`;

    console.log(`📅 アクセス中: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

    // 記事タイトルの一覧を取得（h3.titleクラスで取得）
    const newsTitles = await page.$$eval('h3.title', elements =>
      elements.map(el => el.innerText.trim()).filter(Boolean)
    );

    console.log(`📰 本日のニュース（${newsTitles.length}件）:`);
    newsTitles.slice(0, 5).forEach((title, idx) => {
      console.log(`${idx + 1}. ${title}`);
    });

    await browser.close();
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1); // GitHub Actions で「失敗」にするため
  }
})();
