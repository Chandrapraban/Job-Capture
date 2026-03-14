(function () {
  function isCurrentEmployee(snippet, title, company) {
    if (!company) return true; // can't filter without company name
    const c = company.toLowerCase();
    const text = (snippet + " " + title).toLowerCase();
    // Treat as current if company name appears in the text
    // and there's no strong signal it's a past role only
    return text.includes(c);
  }

  function extractResults(company) {
    const people = [];

    // Collect all result cards — Google uses div.g or the MjjYud container
    const cards = document.querySelectorAll("div.g, div[data-hveid] > div > div");

    for (const card of cards) {
      if (people.length >= 10) break;

      // Find a LinkedIn /in/ link anywhere in the card
      const link = card.querySelector('a[href*="linkedin.com/in/"]');
      if (!link) continue;

      const titleEl = card.querySelector("h3");
      if (!titleEl) continue;

      const rawTitle = titleEl.innerText.trim();
      const name = parseName(rawTitle);
      if (!name) continue;

      // Clean LinkedIn URL
      let profileUrl = link.href;
      try {
        // Handle Google redirect URLs like /url?q=https://linkedin.com/in/...
        if (profileUrl.includes("google.com/url")) {
          const qParam = new URL(profileUrl).searchParams.get("q");
          if (qParam) profileUrl = qParam;
        }
        const u = new URL(profileUrl);
        profileUrl = "https://www.linkedin.com" + u.pathname.replace(/\/$/, "");
      } catch { /* keep original */ }

      // Snippet
      let snippet = "";
      const snippetEl = card.querySelector(".VwiC3b, [class*='VwiC3b'], .lEBKkf, [data-snf]");
      if (snippetEl) snippet = snippetEl.innerText.trim();

      const headlineHint = rawTitle.includes(" - ")
        ? rawTitle.split(" - ").slice(1).join(" - ").replace(/\s*[|·].*$/, "").trim()
        : "";

      const isDukeAlum =
        snippet.toLowerCase().includes("duke") ||
        rawTitle.toLowerCase().includes("duke");

      if (!isCurrentEmployee(snippet, rawTitle, company)) continue;

      people.push({ name, profileUrl, snippet, headlineHint, isDukeAlum });
    }

    // Fallback: if card-based approach found nothing, try raw link scan
    if (people.length === 0) {
      const links = document.querySelectorAll('a[href*="linkedin.com/in/"]');
      for (const link of links) {
        if (people.length >= 10) break;
        const titleEl = link.querySelector("h3") || link.closest("div")?.querySelector("h3");
        if (!titleEl) continue;
        const name = parseName(titleEl.innerText.trim());
        if (!name) continue;
        let profileUrl = link.href;
        try {
          if (profileUrl.includes("google.com/url")) {
            const qParam = new URL(profileUrl).searchParams.get("q");
            if (qParam) profileUrl = qParam;
          }
          const u = new URL(profileUrl);
          profileUrl = "https://www.linkedin.com" + u.pathname.replace(/\/$/, "");
        } catch { /* keep original */ }
        const isDukeAlum = titleEl.innerText.toLowerCase().includes("duke");
        if (!isCurrentEmployee("", titleEl.innerText, company)) continue;
        people.push({ name, profileUrl, snippet: "", headlineHint: "", isDukeAlum });
      }
    }

    return people;
  }

  function parseName(title) {
    let name = title
      .split("|")[0]
      .replace(/-\s*LinkedIn\s*$/i, "")
      .split(" - ")[0]
      .replace(/\bLinkedIn\b/gi, "")
      .trim();
    if (!name || name.length > 60 || name.length < 2) return null;
    return name;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXTRACT_RESULTS") {
      sendResponse({ success: true, people: extractResults(msg.company || "") });
      return true;
    }
  });
})();
