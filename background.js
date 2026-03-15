"use strict";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "FIND_ALUMNI") {
    findAlumni(msg.company, msg.role || "")
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function findAlumni(company, role) {
  const seen = new Set();
  const people = [];

  // Helper: add results to pool, deduping by profileUrl
  function absorb(results) {
    for (const p of results) {
      if (people.length >= 10) break;
      if (!p.profileUrl || seen.has(p.profileUrl)) continue;
      seen.add(p.profileUrl);
      people.push(p);
    }
  }

  // 1. Duke alums at company, relevant to role
  if (role) {
    absorb(await googleSearch(`site:linkedin.com/in "Duke University" "${company}" "${role}"`));
  }

  // 2. Duke alums at company (no role filter)
  if (people.length < 10) {
    absorb(await googleSearch(`site:linkedin.com/in "Duke University" "${company}"`));
  }

  // 3. Anyone at company relevant to role
  if (people.length < 10 && role) {
    absorb(await googleSearch(`site:linkedin.com/in "${company}" "${role}"`));
  }

  // 4. Anyone at company (broad fallback)
  if (people.length < 10) {
    absorb(await googleSearch(`site:linkedin.com/in "${company}"`));
  }

  return { success: true, people: people.slice(0, 10) };
}

async function googleSearch(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
  const tab = await chrome.tabs.create({ url, active: false });

  try {
    await waitForTabLoad(tab.id);
    await sleep(1800);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["google-alumni.js"],
    }).catch(() => {});

    const result = await sendTabMessage(tab.id, { type: "EXTRACT_RESULTS", company });
    return (result && result.people) ? result.people : [];
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timed out"));
    }, 15000);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sendTabMessage(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
