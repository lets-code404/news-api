/* ============================================================
   Tech News Dashboard — JavaScript
   ============================================================
   This script fetches technology news from the Hacker News
   Algolia API for three topics at once and renders them as
   styled cards on the page.
   ============================================================ */

// ── DOM References ──────────────────────────────────────────
const loader = document.getElementById("loader");
const errorBanner = document.getElementById("error-banner");
const retryBtn = document.getElementById("retry-btn");
const newsContainer = document.getElementById("news-container");

// ── Configuration ───────────────────────────────────────────
// The three topics we want to fetch news for.
const TOPICS = ["javascript", "artificial intelligence", "startups"];

// We limit results to the first 5 articles per topic.
const MAX_ARTICLES = 5;

// Base URL for the Hacker News Algolia Search API.
// Appending `?query=<topic>` returns stories matching that topic.
const API_BASE = "https://hn.algolia.com/api/v1/search";

// ── Helper: build a URL for a given topic ───────────────────
// encodeURIComponent ensures spaces and special characters
// are safely encoded (e.g. "artificial intelligence" → "artificial%20intelligence").
function buildUrl(topic) {
    return `${API_BASE}?query=${encodeURIComponent(topic)}`;
}

// ── Emoji lookup for each topic ─────────────────────────────
const TOPIC_EMOJI = {
    javascript: "⚡",
    "artificial intelligence": "🤖",
    startups: "🚀",
};

// ── Fetch news for ALL topics simultaneously ────────────────
/**
 * fetchAllTopics()
 *
 * Uses Promise.all() to fire multiple fetch() requests at the
 * same time.  This is faster than fetching them one-by-one
 * because all network requests run in parallel.
 *
 * Promise.all() takes an array of Promises and returns a single
 * Promise that resolves when ALL of them have resolved.  If any
 * single request fails, the whole Promise.all() rejects — which
 * we catch in our error handler.
 *
 * Flow:
 *   1. TOPICS.map(topic => fetch(url))   → creates an array of fetch Promises
 *   2. Promise.all([ ...fetches ])       → waits for ALL to finish
 *   3. .map(res => res.json())           → converts each Response to JSON
 *   4. Promise.all([ ...jsonPromises ])  → waits for all JSON parsing
 *   5. Returns an array of result objects, one per topic
 */
async function fetchAllTopics() {
    // Step 1 & 2: fire all fetch requests in parallel
    const responses = await Promise.all(
        TOPICS.map((topic) => fetch(buildUrl(topic)))
    );

    // Step 3 & 4: convert every response to JSON (also in parallel)
    const data = await Promise.all(
        responses.map((res) => {
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
        })
    );

    return data;
}

// ── Format a date string into a readable format ─────────────
function formatDate(dateString) {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// ── Build a single news card element ────────────────────────
/**
 * createCardHTML(article)
 *
 * Dynamically generates the HTML for one news card.
 * Each card includes:
 *   • Article title
 *   • Author name
 *   • Points (upvotes)
 *   • Number of comments
 *   • Publication date
 *   • "Read Article" button linking to the story URL
 *
 * We use template literals (back-ticks) so we can embed
 * JavaScript expressions directly inside the string with ${}.
 */
function createCardHTML(article) {
    // The API may return null for some fields; fall back to sensible defaults.
    const title = article.title || "Untitled";
    const author = article.author || "Anonymous";
    const points = article.points ?? 0;
    const comments = article.num_comments ?? 0;
    const date = formatDate(article.created_at);
    const url = article.url || article.story_url || `https://news.ycombinator.com/item?id=${article.objectID}`;

    return `
        <article class="news-card">
            <h3 class="news-card__title">${escapeHTML(title)}</h3>

            <div class="news-card__meta">
                <span>👤 ${escapeHTML(author)}</span>
                <span>▲ ${points} points</span>
                <span>💬 ${comments} comments</span>
                <span>📅 ${date}</span>
            </div>

            <div class="news-card__footer">
                <a class="btn btn--read"
                   href="${escapeHTML(url)}"
                   target="_blank"
                   rel="noopener noreferrer">
                    Read Article →
                </a>
            </div>
        </article>
    `;
}

// ── Escape HTML to prevent XSS ──────────────────────────────
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ── Render all topics to the page ───────────────────────────
/**
 * renderTopics(dataArray)
 *
 * dataArray is an array with one element per topic (in the same
 * order as TOPICS).  For each topic:
 *   1. Create a <section> with a heading that includes the topic
 *      name and an emoji badge.
 *   2. Slice the results to MAX_ARTICLES (first 5).
 *   3. Use .map() to create a card for every article.
 *   4. Append the section to the news container.
 *
 * After rendering:
 *   • Hide the loader
 *   • Show the news container
 */
function renderTopics(dataArray) {
    // Clear any existing content (useful on retry)
    newsContainer.innerHTML = "";

    dataArray.forEach((topicData, index) => {
        const topicName = TOPICS[index];
        const emoji = TOPIC_EMOJI[topicName] || "📰";

        // Limit to the first 5 articles per topic
        const articles = (topicData.hits || []).slice(0, MAX_ARTICLES);

        // Build the section element
        const section = document.createElement("section");
        section.className = "topic-section";
        section.setAttribute("data-topic", topicName);

        // Capitalise topic name for display
        const displayName = topicName
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

        // Generate all card HTML strings and join them together
        const cardsHTML = articles.map(createCardHTML).join("");

        section.innerHTML = `
            <h2 class="topic-section__heading">
                ${emoji} ${displayName}
                <span class="badge">${articles.length} articles</span>
            </h2>
            <div class="cards-grid">
                ${cardsHTML}
            </div>
        `;

        newsContainer.appendChild(section);
    });

    // Toggle visibility: hide loader, show news
    loader.classList.add("hidden");
    newsContainer.classList.remove("hidden");
}

// ── Main: orchestrate fetching and rendering ────────────────
/**
 * loadNews()
 *
 * This is the main async function that:
 *   1. Shows the loading spinner.
 *   2. Hides any previous error or news content.
 *   3. Calls fetchAllTopics() which uses Promise.all() to
 *      fetch all three topics at the same time.
 *   4. Passes the results to renderTopics() which dynamically
 *      creates the news cards using DOM manipulation.
 *   5. If anything goes wrong, it catches the error and shows
 *      a user-friendly error banner instead.
 */
async function loadNews() {
    // Reset UI state
    loader.classList.remove("hidden");
    errorBanner.classList.add("hidden");
    newsContainer.classList.add("hidden");

    try {
        // Fetch all three topics in parallel using Promise.all()
        const data = await fetchAllTopics();

        // Render the fetched data as cards on the page
        renderTopics(data);
    } catch (error) {
        // If the API fails, hide the loader and show a friendly error message.
        console.error("Failed to fetch news:", error);
        loader.classList.add("hidden");
        errorBanner.classList.remove("hidden");
    }
}

// ── Retry button ────────────────────────────────────────────
// Clicking "Retry" re-runs the entire load process.
retryBtn.addEventListener("click", loadNews);

// ── Kick everything off on page load ────────────────────────
loadNews();
