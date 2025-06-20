// nhk_scraper.js
const puppeteer = require('puppeteer');

(async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const url = `https://www3.nhk.or.jp/news/html/${yyyy}${mm}${dd}/`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const headlines = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.content--list-item-title'));
      return items.slice(0, 5).map(el => el.innerText.trim());
    });

    console.log(`📅 ${yyyy}/${mm}/${dd} のニュース一覧`);
    headlines.forEach((title, idx) => {
      console.log(`□ ${title}`);
    });
  } catch (e) {
    console.error('❌ 取得に失敗しました：', e);
  } finally {
    await browser.close();
  }
})();
