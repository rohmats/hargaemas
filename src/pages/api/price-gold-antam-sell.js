const Cheerio = require('cheerio');
const dayjs = require('dayjs');

/**
 * Extract cookie value from set-cookie header
 */
function extractCookie(cookies, cookieName) {
  if (!cookies) return null;

  const cookieArray = cookies.split(/,\s?/);
  for (const cookie of cookieArray) {
    const [name, value] = cookie.split('=');
    if (name.trim() === cookieName) {
      return value.split(';')[0];
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Step 1: Fetch homepage to get CSRF token
    const response = await fetch("https://www.logammulia.com/id", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch homepage: ${response.status}`);
    }

    const html = await response.text();

    // Step 2: Extract CSRF token from HTML
    const $ = Cheerio.load(html);
    const token = $('input[name="_token"]').attr('value');

    if (!token) {
      throw new Error("CSRF token not found in page");
    }

    console.log('✅ Token found for sell endpoint');

    // Step 3: Extract cookies
    const cookies = response.headers.get('set-cookie');
    const xsrfToken = extractCookie(cookies, 'XSRF-TOKEN');
    const logammuliaSession = extractCookie(cookies, 'logammulia_session');

    // Step 4: Fetch gold sell price data
    const apiUrl = `https://www.logammulia.com/data-base-price/gold_eai/sell?_token=${token}&transition=1`;
    
    const jsonResponse = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.logammulia.com/id',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(xsrfToken && logammuliaSession && {
          'Cookie': `XSRF-TOKEN=${xsrfToken}; logammulia_session=${logammuliaSession}`
        })
      },
    });

    if (!jsonResponse.ok) {
      throw new Error(`API fetch failed with status ${jsonResponse.status}`);
    }

    // Step 5: Parse and return JSON data
    const goldData = await jsonResponse.json();
    
    res.status(200).json(goldData);
  } catch (error) {
    console.error("❌ Error fetching gold sell data:", error.message);
    res.status(500).json({ 
      message: "Error fetching gold data", 
      error: error.message 
    });
  }
}
