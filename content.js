(function () {
  function extractJobTitle() {
    const h = window.location.hostname;

    if (h.includes("linkedin.com")) {
      const el = document.querySelector(".job-details-jobs-unified-top-card__job-title h1")
        || document.querySelector(".jobs-unified-top-card__job-title h1")
        || document.querySelector("h1.t-24");
      if (el) return el.innerText.trim();
    }

    if (h.includes("greenhouse.io")) {
      const el = document.querySelector("h1.app-title") || document.querySelector("#header h1");
      if (el) return el.innerText.trim();
    }

    if (h.includes("jobs.lever.co")) {
      const el = document.querySelector(".posting-headline h2") || document.querySelector("h2");
      if (el) return el.innerText.trim();
    }

    if (h.includes("myworkdayjobs.com")) {
      const el = document.querySelector("[data-automation-id='jobPostingHeader']");
      if (el) return el.innerText.trim();
    }

    if (h.includes("indeed.com")) {
      const el = document.querySelector("h1.jobsearch-JobInfoHeader-title")
        || document.querySelector("[data-jk] h1");
      if (el) return el.innerText.trim();
    }

    // Generic
    const selectors = ["h1[class*='title']", "h1[class*='job']", "h1[class*='position']", "h1"];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }

    return document.title.split(/[-|–—]/)[0].trim();
  }

  function extractCompanyName() {
    const h = window.location.hostname;

    if (h.includes("linkedin.com")) {
      const el = document.querySelector(".job-details-jobs-unified-top-card__company-name a")
        || document.querySelector(".jobs-unified-top-card__company-name a");
      if (el) return el.innerText.trim();
    }

    if (h.includes("greenhouse.io")) {
      const el = document.querySelector(".company-name") || document.querySelector("#header .company-name");
      if (el) return el.innerText.trim();
      const m = window.location.pathname.match(/^\/([^/]+)/);
      if (m) return m[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    if (h.includes("jobs.lever.co")) {
      const m = window.location.pathname.match(/^\/([^/]+)/);
      if (m) return m[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    if (h.includes("myworkdayjobs.com")) {
      return h.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    if (h.includes("indeed.com")) {
      const el = document.querySelector("[data-company-name]") || document.querySelector("[class*='companyName']");
      if (el) return (el.getAttribute("data-company-name") || el.innerText).trim();
    }

    const selectors = ["[class*='company-name']", "[class*='companyName']", "[class*='employer']",
      "[itemprop='hiringOrganization'] [itemprop='name']"];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }

    const parts = document.title.split(/[-|–—]/);
    return parts.length >= 2 ? parts[1].trim() : "";
  }

  function extractDescription() {
    const h = window.location.hostname;
    let el = null;

    if (h.includes("linkedin.com"))
      el = document.querySelector(".jobs-description-content__text")
        || document.querySelector("[class*='jobs-description']");
    else if (h.includes("greenhouse.io"))
      el = document.querySelector("#content") || document.querySelector(".job-post");
    else if (h.includes("jobs.lever.co"))
      el = document.querySelector(".posting-requirements") || document.querySelector(".posting-description");
    else if (h.includes("myworkdayjobs.com"))
      el = document.querySelector("[data-automation-id='jobPostingDescription']");
    else if (h.includes("indeed.com"))
      el = document.querySelector("#jobDescriptionText");

    if (!el) {
      for (const s of ["[class*='job-description']", "[class*='jobDescription']", "[id*='job-description']", "article", "main"]) {
        const found = document.querySelector(s);
        if (found && found.innerText.trim().length > 100) { el = found; break; }
      }
    }

    if (!el) return "";
    const text = el.innerText.replace(/\n{3,}/g, "\n\n").trim();
    return text.length > 5000 ? text.slice(0, 5000) + "…" : text;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXTRACT_JOB_INFO") {
      try {
        sendResponse({
          success: true,
          data: {
            role:        extractJobTitle(),
            company:     extractCompanyName(),
            url:         window.location.href,
            timestamp:   new Date().toISOString(),
            description: extractDescription(),
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });
})();
