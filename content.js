/**
 * content.js
 * Injected into the active tab to extract job posting data.
 * Only runs when explicitly messaged from the popup.
 */

(function () {
  function extractJobTitle() {
    const hostname = window.location.hostname;

    if (hostname.includes("linkedin.com")) {
      const el =
        document.querySelector(".job-details-jobs-unified-top-card__job-title h1") ||
        document.querySelector(".jobs-unified-top-card__job-title h1") ||
        document.querySelector("h1.t-24");
      if (el) return el.innerText.trim();
    }

    if (hostname.includes("greenhouse.io") || hostname.includes("boards.greenhouse.io")) {
      const el =
        document.querySelector("h1.app-title") ||
        document.querySelector("#header h1") ||
        document.querySelector("h1");
      if (el) return el.innerText.trim();
    }

    if (hostname.includes("jobs.lever.co")) {
      const el =
        document.querySelector(".posting-headline h2") ||
        document.querySelector("h2");
      if (el) return el.innerText.trim();
    }

    if (hostname.includes("myworkdayjobs.com")) {
      const el =
        document.querySelector("[data-automation-id='jobPostingHeader']") ||
        document.querySelector("h2.css-1ul70lm");
      if (el) return el.innerText.trim();
    }

    if (hostname.includes("indeed.com")) {
      const el =
        document.querySelector("[data-jk] h1") ||
        document.querySelector("h1.jobsearch-JobInfoHeader-title");
      if (el) return el.innerText.trim();
    }

    const genericSelectors = [
      "h1[class*='title']", "h1[class*='job']", "h1[class*='position']",
      "h1[class*='role']", "[class*='job-title'] h1", "[class*='jobtitle'] h1",
      "[class*='position-title'] h1", "h1",
    ];
    for (const sel of genericSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }

    const parts = document.title.split(/[-|–—]/);
    return parts[0].trim() || document.title.trim();
  }

  function extractCompanyName() {
    const hostname = window.location.hostname;

    if (hostname.includes("linkedin.com")) {
      const el =
        document.querySelector(".job-details-jobs-unified-top-card__company-name a") ||
        document.querySelector(".jobs-unified-top-card__company-name a") ||
        document.querySelector(".jobs-unified-top-card__subtitle-primary-grouping a");
      if (el) return el.innerText.trim();
    }

    if (hostname.includes("greenhouse.io") || hostname.includes("boards.greenhouse.io")) {
      const el =
        document.querySelector("#header .company-name") ||
        document.querySelector(".company-name");
      if (el) return el.innerText.trim();
      const match = window.location.pathname.match(/^\/([^/]+)/);
      if (match) return match[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (hostname.includes("jobs.lever.co")) {
      const match = window.location.pathname.match(/^\/([^/]+)/);
      if (match) return match[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (hostname.includes("myworkdayjobs.com")) {
      const subdomain = hostname.split(".")[0];
      return subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (hostname.includes("indeed.com")) {
      const el =
        document.querySelector("[data-company-name]") ||
        document.querySelector(".jobsearch-InlineCompanyRating-companyHeader a") ||
        document.querySelector("[class*='companyName']");
      if (el) return (el.getAttribute("data-company-name") || el.innerText).trim();
    }

    const genericSelectors = [
      "[class*='company-name']", "[class*='companyName']", "[class*='company_name']",
      "[class*='employer']", "[class*='organization']",
      "[itemprop='hiringOrganization'] [itemprop='name']", "[itemprop='name']",
    ];
    for (const sel of genericSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }

    const titleParts = document.title.split(/[-|–—]/);
    if (titleParts.length >= 2) return titleParts[1].trim();
    return "";
  }

  /**
   * Extract job description text.
   * Returns plain text, capped at 5000 characters to stay within Sheets cell limits.
   */
  function extractJobDescription() {
    const hostname = window.location.hostname;
    let el = null;

    // --- LinkedIn ---
    if (hostname.includes("linkedin.com")) {
      el =
        document.querySelector(".jobs-description-content__text") ||
        document.querySelector(".jobs-box__html-content") ||
        document.querySelector("[class*='jobs-description']");
    }

    // --- Greenhouse ---
    else if (hostname.includes("greenhouse.io") || hostname.includes("boards.greenhouse.io")) {
      el =
        document.querySelector("#content") ||
        document.querySelector(".job-post") ||
        document.querySelector("[class*='job-description']");
    }

    // --- Lever ---
    else if (hostname.includes("jobs.lever.co")) {
      el =
        document.querySelector(".posting-requirements") ||
        document.querySelector("[class*='section-wrapper']") ||
        document.querySelector(".posting-description");
    }

    // --- Workday ---
    else if (hostname.includes("myworkdayjobs.com")) {
      el =
        document.querySelector("[data-automation-id='jobPostingDescription']") ||
        document.querySelector("[class*='job-description']");
    }

    // --- Indeed ---
    else if (hostname.includes("indeed.com")) {
      el =
        document.querySelector("#jobDescriptionText") ||
        document.querySelector("[class*='jobsearch-jobDescriptionText']");
    }

    // --- Generic fallback ---
    if (!el) {
      const candidates = [
        "[class*='job-description']",
        "[class*='jobDescription']",
        "[class*='job_description']",
        "[class*='description']",
        "[id*='job-description']",
        "[id*='jobDescription']",
        "article",
        "main",
      ];
      for (const sel of candidates) {
        const found = document.querySelector(sel);
        if (found && found.innerText.trim().length > 100) {
          el = found;
          break;
        }
      }
    }

    if (!el) return "";

    // Clean up whitespace and cap length
    const text = el.innerText
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text.length > 5000 ? text.slice(0, 5000) + "…" : text;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "EXTRACT_JOB_INFO") {
      try {
        const data = {
          role:        extractJobTitle(),
          company:     extractCompanyName(),
          url:         window.location.href,
          timestamp:   new Date().toISOString(),
          description: extractJobDescription(),
        };
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });
})();
