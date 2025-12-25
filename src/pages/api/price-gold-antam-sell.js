const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dayjs = require('dayjs');

puppeteer.use(StealthPlugin());

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let browser;
  try {
    // Launch browser with stealth mode
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
    });

    const page = await browser.newPage();
    
    // Navigate to homepage and wait for token
    await page.goto('https://www.logammulia.com/id', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    await page.waitForSelector('input[name="_token"]', { timeout: 10000 });

    // Extract CSRF token
    const token = await page.$eval('input[name="_token"]', el => el.value);
    console.log('✅ Token found for sell endpoint');

    // Get current date in WIB timezone (UTC+7)
    const transitionDate = dayjs().add(7, 'hour').format('YYYY-MM-DD');

    // Fetch gold sell price data using page.evaluate
    const apiUrl = `https://www.logammulia.com/data-base-price/gold_eai/sell?_token=${token}&transition=1&transition_date=${transitionDate}`;
    
    const resultText = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      return await response.text();
    }, apiUrl);

    // Parse and return JSON data
    const goldData = JSON.parse(resultText);
    
    res.status(200).json(goldData);
  } catch (error) {
    console.error("❌ Error fetching gold sell data:", error.message);
    res.status(500).json({ 
      message: "Error fetching gold data", 
      error: error.message 
    });
  } finally {
    // Always close browser to prevent memory leaks
    if (browser) {
      await browser.close();
    }
  }
}
