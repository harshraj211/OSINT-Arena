/**
 * seed.js
 * Populates Firestore with sample OSINT challenges for development/testing.
 *
 * Usage:
 *   node seed.js
 *
 * Requirements:
 *   - Firebase Admin SDK service account key at ./serviceAccountKey.json
 *   - Or set GOOGLE_APPLICATION_CREDENTIALS env var
 *
 * Run once:
 *   cd osint-arena
 *   node seed.js
 *
 * To reset and re-seed:
 *   node seed.js --reset
 *
 * File location: osint-arena/seed.js
 */

"use strict";

const admin  = require("firebase-admin");
const crypto = require("crypto");
const path   = require("path");

// ── Init ──────────────────────────────────────────────────────────────────────
let serviceAccount;
try {
  serviceAccount = require("./serviceAccountKey.json");
} catch {
  console.error(
    "❌  serviceAccountKey.json not found.\n" +
    "   Download it from Firebase Console → Project Settings → Service Accounts\n" +
    "   → Generate new private key → save as osint-arena/serviceAccountKey.json"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Answer hashing (matches functions/src/lib/hashAnswer.js) ─────────────────
function normalizeAnswer(raw) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');
}

function hashAnswer(normalized) {
  return crypto
    .createHash("sha256")
    .update(normalized + "osint-arena-salt-2024")
    .digest("hex");
}

// ── Challenge definitions ─────────────────────────────────────────────────────
const CHALLENGES = [

  // ════════════════════════════════════════════════════════════════════
  // EASY CHALLENGES  (freeForAll: true — all accessible to free tier)
  // ════════════════════════════════════════════════════════════════════

  {
    slug:        "google-dork-basics",
    title:       "Google Dork Basics",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  50,
    category:    "search",
    tags:        ["google", "dorking", "search-operators"],
    description: `## Google Dork Basics

The \`site:\` operator restricts Google results to a specific domain.

**Task:** Use Google to find the official email address listed on the **contact page** of \`example.com\`.

> Hint: Try \`site:example.com contact\`

What is the top-level domain of the IANA example domain?`,
    hint:        "IANA manages example.com — check their whois or the site itself.",
    answer:      "example.com",
    expectedTime: 5,
  },

  {
    slug:        "whois-lookup",
    title:       "WHOIS Lookup",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  50,
    category:    "domain-recon",
    tags:        ["whois", "domain", "registration"],
    description: `## WHOIS Lookup

WHOIS records reveal domain registration details including registrar, creation date, and sometimes owner contact info.

**Task:** Look up the WHOIS record for \`wikipedia.org\`.

What is the name of the registrar that manages the \`wikipedia.org\` domain?`,
    hint:        "Use whois.domaintools.com or simply run: whois wikipedia.org",
    answer:      "markmonitor inc.",
    expectedTime: 5,
  },

  {
    slug:        "reverse-image-search",
    title:       "Reverse Image Search",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  50,
    category:    "image-osint",
    tags:        ["reverse-image", "google-images", "tineye"],
    description: `## Reverse Image Search

Reverse image search helps identify the source, location, or subject of an image.

**Task:** The OSINT Framework logo is a well-known image in the intelligence community.

Go to \`osintframework.com\` and find the name of the person who created the OSINT Framework.`,
    hint:        "Check the About section or footer of osintframework.com",
    answer:      "justin nordine",
    expectedTime: 5,
  },

  {
    slug:        "metadata-extraction",
    title:       "Metadata Extraction",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  75,
    category:    "metadata",
    tags:        ["exif", "metadata", "images"],
    description: `## Metadata Extraction

Images often contain hidden EXIF metadata including GPS coordinates, device info, and timestamps.

**Task:** What tool/command is commonly used on Linux to extract EXIF metadata from images?

Enter the name of the most widely-used command-line EXIF tool.`,
    hint:        "It's a Perl-based tool, often pre-installed on Kali Linux.",
    answer:      "exiftool",
    expectedTime: 5,
  },

  {
    slug:        "shodan-intro",
    title:       "Shodan: The Search Engine for Devices",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  75,
    category:    "network-osint",
    tags:        ["shodan", "iot", "network"],
    description: `## Shodan: The Search Engine for Devices

Shodan indexes internet-connected devices and services — cameras, routers, servers, and more.

**Task:** What is the tagline/slogan that Shodan uses to describe itself on its homepage at \`shodan.io\`?`,
    hint:        "Visit shodan.io and look at the hero section.",
    answer:      "the search engine for the internet of everything",
    expectedTime: 5,
  },

  {
    slug:        "linkedin-recon",
    title:       "LinkedIn Recon",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  75,
    category:    "social-media",
    tags:        ["linkedin", "social-media", "people-search"],
    description: `## LinkedIn Recon

LinkedIn is a goldmine for OSINT — employees, org charts, technologies, and more.

**Task:** Using Google dorks, find LinkedIn profiles without logging in.

What Google search operator would you use to search for LinkedIn profiles of people with "OSINT" in their title at a company called "Bellingcat"?

Write the search query you would use (just the operators, not a full URL).`,
    hint:        'Combine site:, "", and the job title.',
    answer:      'site:linkedin.com "osint" "bellingcat"',
    expectedTime: 8,
  },

  {
    slug:        "wayback-machine",
    title:       "Wayback Machine",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  75,
    category:    "web-archive",
    tags:        ["wayback", "archive", "historical"],
    description: `## Wayback Machine

The Internet Archive's Wayback Machine stores historical snapshots of websites.

**Task:** Go to \`web.archive.org\` and find the earliest archived snapshot of \`google.com\`.

In what year was the first snapshot of google.com captured by the Wayback Machine?`,
    hint:        "Search google.com on archive.org and scroll to the earliest year on the calendar.",
    answer:      "1998",
    expectedTime: 5,
  },

  {
    slug:        "username-search",
    title:       "Username Search",
    difficulty:  "easy",
    freeForAll:  true,
    basePoints:  75,
    category:    "social-media",
    tags:        ["username", "sherlock", "social-media"],
    description: `## Username Search

A single username can reveal accounts across dozens of platforms.

**Task:** What is the name of the popular open-source Python tool used to hunt down social media accounts by username across multiple platforms?`,
    hint:        "It's named after a famous fictional detective.",
    answer:      "sherlock",
    expectedTime: 5,
  },

  // ════════════════════════════════════════════════════════════════════
  // MEDIUM CHALLENGES  (first 30% have freeForAll: true)
  // ════════════════════════════════════════════════════════════════════

  {
    slug:        "geolocation-landmarks",
    title:       "Geolocation by Landmarks",
    difficulty:  "medium",
    freeForAll:  true,   // free 30%
    basePoints:  150,
    category:    "geolocation",
    tags:        ["geolocation", "landmarks", "google-maps"],
    description: `## Geolocation by Landmarks

Geolocating images using visible landmarks, shadows, vegetation, and architecture is a core OSINT skill.

**Task:** The Bellingcat building used in their online investigations training is located in a European city.

What city is Bellingcat's registered office located in? (Check their official website's legal/about section.)`,
    hint:        "Check the footer or legal pages of bellingcat.com for their registered address.",
    answer:      "amsterdam",
    expectedTime: 10,
  },

  {
    slug:        "dns-enumeration",
    title:       "DNS Enumeration",
    difficulty:  "medium",
    freeForAll:  true,   // free 30%
    basePoints:  150,
    category:    "domain-recon",
    tags:        ["dns", "subdomains", "enumeration"],
    description: `## DNS Enumeration

DNS records reveal mail servers, subdomains, IP addresses, and infrastructure details.

**Task:** Find the MX (mail exchange) record for \`protonmail.com\`.

What is the hostname of ProtonMail's primary MX record? (the one with the lowest priority number)`,
    hint:        "Use: nslookup -type=MX protonmail.com  or  dig MX protonmail.com",
    answer:      "mail.protonmail.ch",
    expectedTime: 10,
  },

  {
    slug:        "github-recon",
    title:       "GitHub OSINT",
    difficulty:  "medium",
    freeForAll:  true,   // free 30%
    basePoints:  150,
    category:    "code-recon",
    tags:        ["github", "git", "code-recon"],
    description: `## GitHub OSINT

GitHub repositories, commit history, and user profiles can reveal developer identities, emails, and infrastructure details.

**Task:** The \`truffleHog\` tool is used to find secrets in git repositories.

Search GitHub for the \`truffleHog\` repository. What is the GitHub username of the original author/owner of the truffleHog repository?`,
    hint:        "Search github.com for truffleHog and look at the repository owner.",
    answer:      "dxa4481",
    expectedTime: 10,
  },

  {
    slug:        "certificate-transparency",
    title:       "Certificate Transparency Logs",
    difficulty:  "medium",
    freeForAll:  false,  // Pro only
    basePoints:  175,
    category:    "domain-recon",
    tags:        ["ssl", "certificates", "subdomains", "crt.sh"],
    description: `## Certificate Transparency Logs

SSL certificate transparency logs are public records of every SSL certificate ever issued — a goldmine for subdomain discovery.

**Task:** Use \`crt.sh\` to find subdomains of \`tesla.com\` from certificate transparency logs.

How many unique subdomains of tesla.com can you find listed on crt.sh? (Enter the first subdomain listed alphabetically, excluding wildcards)`,
    hint:        "Go to crt.sh and search for %.tesla.com",
    answer:      "api.tesla.com",
    expectedTime: 15,
  },

  {
    slug:        "osint-framework-category",
    title:       "OSINT Framework Navigation",
    difficulty:  "medium",
    freeForAll:  false,  // Pro only
    basePoints:  150,
    category:    "tools",
    tags:        ["osint-framework", "tools", "categorization"],
    description: `## OSINT Framework Navigation

The OSINT Framework (osintframework.com) organises hundreds of OSINT tools into categories.

**Task:** Navigate to \`osintframework.com\`.

Under the "Username" category, what is the name of the first tool listed that can search for usernames across multiple social networks? (it starts with the letter 'K')`,
    hint:        "Expand the Username branch on the OSINT Framework mindmap.",
    answer:      "knowem",
    expectedTime: 10,
  },

  {
    slug:        "social-media-geolocation",
    title:       "Social Media Geolocation",
    difficulty:  "medium",
    freeForAll:  false,  // Pro only
    basePoints:  200,
    category:    "geolocation",
    tags:        ["twitter", "geolocation", "social-media"],
    description: `## Social Media Geolocation

Social media posts often contain location metadata or visual clues that allow precise geolocation.

**Task:** Twitter/X embeds location data in some tweets. What is the name of the API endpoint format used by Twitter to retrieve tweet details including any embedded geo coordinates?

Format your answer as the path only (e.g. \`/api/endpoint\`)`,
    hint:        "Look up the Twitter v2 API documentation for single tweet lookup.",
    answer:      "/2/tweets",
    expectedTime: 15,
  },

  // ════════════════════════════════════════════════════════════════════
  // HARD CHALLENGES  (all Pro-only except weekly free rotation)
  // ════════════════════════════════════════════════════════════════════

  {
    slug:        "advanced-google-dorking",
    title:       "Advanced Google Dorking",
    difficulty:  "hard",
    freeForAll:  false,
    basePoints:  300,
    category:    "search",
    tags:        ["google", "dorking", "advanced", "filetype"],
    description: `## Advanced Google Dorking

Combining multiple Google dork operators can surface sensitive information that administrators accidentally left public.

**Task:** You are investigating a company's security posture.

What Google dork would you use to find Excel spreadsheets (.xlsx) containing the word "password" hosted on government (.gov) domains?

Write the exact search query.`,
    hint:        "Combine filetype:, site:, and a keyword operator.",
    answer:      'filetype:xlsx site:gov "password"',
    expectedTime: 20,
  },

  {
    slug:        "dark-web-osint",
    title:       "Tor Hidden Services Research",
    difficulty:  "hard",
    freeForAll:  false,
    basePoints:  350,
    category:    "dark-web",
    tags:        ["tor", "onion", "dark-web"],
    description: `## Tor Hidden Services Research

Understanding Tor hidden services is essential for threat intelligence work.

**Task:** Tor hidden service addresses end in a specific TLD.

What is the top-level domain used exclusively by Tor hidden services?`,
    hint:        "It's a pseudo-TLD not resolvable on the clearnet.",
    answer:      ".onion",
    expectedTime: 10,
  },

  {
    slug:        "maltego-transforms",
    title:       "Maltego Entity Transforms",
    difficulty:  "hard",
    freeForAll:  false,
    basePoints:  400,
    category:    "tools",
    tags:        ["maltego", "transforms", "graph", "intel"],
    description: `## Maltego Entity Transforms

Maltego is a visual link analysis tool that maps relationships between entities using "transforms".

**Task:** In Maltego, what is the name of the standard transform used to go from a **Domain** entity to discover its **DNS Name** (subdomain) entities?

Enter the exact transform name as it appears in Maltego.`,
    hint:        "Look at the Paterva/standard Maltego transforms for DNS operations.",
    answer:      "to dns name",
    expectedTime: 25,
  },

  {
    slug:        "phone-number-osint",
    title:       "Phone Number Intelligence",
    difficulty:  "hard",
    freeForAll:  false,
    basePoints:  350,
    category:    "people-search",
    tags:        ["phone", "osint", "carrier", "phoneinfoga"],
    description: `## Phone Number Intelligence

Phone numbers can reveal carrier information, geographic origin, and linked accounts.

**Task:** What is the name of the open-source tool written in Go that performs reconnaissance on phone numbers, including carrier lookup, line type, and reputation checks?`,
    hint:        "It's a Go-based tool, available on GitHub, commonly used in OSINT investigations.",
    answer:      "phoneinfoga",
    expectedTime: 15,
  },

  {
    slug:        "breach-data-analysis",
    title:       "Breach Data Analysis",
    difficulty:  "hard",
    freeForAll:  false,
    basePoints:  400,
    category:    "data-breach",
    tags:        ["breach", "haveibeenpwned", "credentials"],
    description: `## Breach Data Analysis

Data breaches expose credentials and personal information that can be used in OSINT investigations.

**Task:** Troy Hunt operates the most well-known public breach notification service.

What is the name of the API that HaveIBeenPwned provides for checking if a password has appeared in known data breaches — without sending the actual password?`,
    hint:        "It uses k-anonymity — only a partial hash is sent to the API.",
    answer:      "pwned passwords api",
    expectedTime: 20,
  },

  {
    slug:        "satellite-imagery-analysis",
    title:       "Satellite Imagery Analysis",
    difficulty:  "hard",
    freeForAll:  false,
    basePoints:  450,
    category:    "geolocation",
    tags:        ["satellite", "imagery", "sentinel", "geoint"],
    description: `## Satellite Imagery Analysis

Free satellite imagery from ESA's Sentinel program and NASA can be used for geospatial intelligence.

**Task:** The European Space Agency provides free satellite imagery through the Copernicus programme.

What is the name of the ESA browser tool (web application) used to search, visualise, and download Sentinel satellite imagery?`,
    hint:        "It's a web-based tool at apps.sentinel-hub.com or similar ESA portals.",
    answer:      "copernicus browser",
    expectedTime: 20,
  },

];

// ── Seed function ─────────────────────────────────────────────────────────────
async function seed() {
  const args  = process.argv.slice(2);
  const reset = args.includes("--reset");

  console.log("🌱  OSINT Arena — Challenge Seed Script");
  console.log(`   Challenges to seed: ${CHALLENGES.length}`);
  console.log(`   Reset mode: ${reset ? "YES — will delete existing challenges" : "NO"}\n`);

  if (reset) {
    console.log("🗑   Deleting existing challenges...");
    const existing = await db.collection("challenges").get();
    const deleteBatch = db.batch();
    existing.docs.forEach(d => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
    console.log(`   Deleted ${existing.size} challenges.\n`);
  }

  // Write challenges in batches of 10 (Firestore batch limit is 500 ops)
  let created = 0;
  let skipped = 0;

  for (const challenge of CHALLENGES) {
    // Check if slug already exists
    const existing = await db
      .collection("challenges")
      .where("slug", "==", challenge.slug)
      .limit(1)
      .get();

    if (!existing.empty && !reset) {
      console.log(`   ⏭  Skipping "${challenge.title}" — already exists`);
      skipped++;
      continue;
    }

    // Hash the answer
    const normalized = normalizeAnswer(challenge.answer);
    const answerHash = hashAnswer(normalized);

    const doc = {
      slug:         challenge.slug,
      title:        challenge.title,
      difficulty:   challenge.difficulty,
      freeForAll:   challenge.freeForAll,
      basePoints:   challenge.basePoints,
      category:     challenge.category,
      tags:         challenge.tags,
      description:  challenge.description,
      hint:         challenge.hint,
      answerHash,                          // stored, never sent to client
      expectedTime: challenge.expectedTime,
      isActive:         true,
      isFreeThisWeek:   false,
      solveCount:       0,
      attemptCount:     0,
      createdAt:        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("challenges").doc().set(doc);
    console.log(`   ✅  Created: [${challenge.difficulty.toUpperCase()}] ${challenge.title}`);
    created++;
  }

  console.log(`\n✨  Done! Created: ${created}  Skipped: ${skipped}`);
  console.log("\nNext steps:");
  console.log("  1. Open Firebase Console → Firestore → challenges collection");
  console.log("  2. Verify all 14 challenges are present");
  console.log("  3. Run the app and check the Challenges page");
  console.log("  4. Set config/weeklyFreeChallenge to one of the hard challenge IDs\n");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});