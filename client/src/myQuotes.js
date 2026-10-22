// The quote IDs this browser saved. History only asks the server for these,
// so visitors never see each other's quotes.
const KEY = 'mqe.quotes';

export function myQuoteIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function rememberQuote(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...myQuoteIds().filter((x) => x !== id)].slice(0, 100)));
  } catch {
    /* storage blocked: the quote is still saved on the server and in the PDF */
  }
}
