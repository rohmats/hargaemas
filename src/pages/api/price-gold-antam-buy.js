const Cheerio = require("cheerio");

/**
 * Extract cookie value from set-cookie header
 */
function extractCookie(cookies, cookieName) {
  if (!cookies) return null;

  const cookieArray = cookies.split(/,\s?/);
  for (const cookie of cookieArray) {
    const [name, value] = cookie.split("=");
    if (name.trim() === cookieName) {
      return value.split(";")[0];
    }
  }

  return null;
}

/**
 * Get current date in WIB timezone (UTC+7)
 */
function getWIBDate() {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wibTime = new Date(utcTime + (7 * 3600000));
  return wibTime.toISOString().split('T')[0]; // YYYY-MM-DD
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Step 1: Fetch homepage to get CSRF token
    const response = await fetch("https://www.logammulia.com/id", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch homepage: ${response.status}`);
    }

    const html = await response.text();

    // Step 2: Extract cookies
    const cookies = response.headers.get("set-cookie");
    const xsrfToken = extractCookie(cookies, "XSRF-TOKEN");
    const logammuliaSession = extractCookie(cookies, "logammulia_session");

    if (!xsrfToken || !logammuliaSession) {
      throw new Error("Required cookies not found");
    }

    // Step 3: Extract CSRF token from meta tag
    const $ = Cheerio.load(html);
    const token = $('input[name="_token"]').attr("value") || $('meta[name="_token"]').attr("content");

    if (!token) {
      throw new Error("CSRF token not found in page");
    }

    console.log("✅ Token found for buy endpoint");

    // Step 4: Get current date in WIB timezone
    const transitionDate = getWIBDate();

    // Step 5: Fetch gold buy price data
    const apiUrl = `https://www.logammulia.com/data-base-price/gold_eai/buy?_token=${token}&transition=1&transition_date=${transitionDate}`;
    
    const jsonResponse = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": `XSRF-TOKEN=${xsrfToken}; logammulia_session=${logammuliaSession}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.logammulia.com/id",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    if (!jsonResponse.ok) {
      const bodyText = await jsonResponse.text();
      console.error("❌ API fetch failed", { 
        status: jsonResponse.status, 
        bodySnippet: bodyText.slice(0, 300) 
      });
      throw new Error(`API fetch failed with status ${jsonResponse.status}`);
    }

    // Step 6: Parse and return JSON data
    const goldData = await jsonResponse.json();
    
    res.status(200).json(goldData);
  } catch (error) {
    console.error("❌ Error fetching gold buy data:", error.message);
    res.status(500).json({ 
      message: "Error fetching gold data", 
      error: error.message 
    });
  }
}
