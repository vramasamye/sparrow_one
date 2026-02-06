import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const topics = [
  {
    name: "AI & Machine Learning",
    slug: "ai-machine-learning",
    description: "Artificial intelligence research, LLMs, deep learning breakthroughs, and AI industry news",
    icon: "brain",
  },
  {
    name: "Cybersecurity",
    slug: "cybersecurity",
    description: "Security threats, vulnerabilities, data breaches, and cybersecurity research",
    icon: "shield",
  },
  {
    name: "Web Development",
    slug: "web-development",
    description: "Frontend frameworks, web standards, JavaScript ecosystem, and modern web development practices",
    icon: "code",
  },
  {
    name: "Cloud & DevOps",
    slug: "cloud-devops",
    description: "Cloud infrastructure, containers, CI/CD, Kubernetes, and platform engineering",
    icon: "cloud",
  },
  {
    name: "Startups & Venture Capital",
    slug: "startups-vc",
    description: "Startup funding, VC deals, founder strategies, and the startup ecosystem",
    icon: "rocket",
  },
  {
    name: "Fintech & Digital Finance",
    slug: "fintech",
    description: "Financial technology, digital payments, neobanks, and the future of finance",
    icon: "trending-up",
  },
  {
    name: "Developer Tools & Open Source",
    slug: "developer-tools-open-source",
    description: "Developer tooling, open source projects, programming languages, and the developer ecosystem",
    icon: "terminal",
  },
  {
    name: "Data Science & Analytics",
    slug: "data-science",
    description: "Data engineering, analytics, databases, machine learning applications, and data infrastructure",
    icon: "database",
  },
  {
    name: "Sustainability & Climate Tech",
    slug: "climate-tech",
    description: "Clean energy, climate technology, sustainability innovation, and environmental policy",
    icon: "leaf",
  },
  {
    name: "Blockchain & Web3",
    slug: "blockchain-web3",
    description: "Cryptocurrency, DeFi, blockchain protocols, NFTs, and decentralized technology",
    icon: "link",
  },
]

const rssFeeds = [
  // AI & Machine Learning
  {
    topicSlug: "ai-machine-learning",
    name: "MIT Technology Review - AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    description: "Premier AI analysis and reporting",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    description: "Dedicated AI news coverage",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    description: "Influential AI/LLM practitioner",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "Gary Marcus",
    url: "https://garymarcus.substack.com/feed",
    description: "Leading AI analysis and criticism",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "Berkeley AI Research (BAIR)",
    url: "https://bair.berkeley.edu/blog/feed.xml",
    description: "Top academic AI research lab",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "The Gradient",
    url: "https://thegradient.pub/rss/",
    description: "AI research community publication",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    description: "Open-source AI/ML community hub",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "AI Snake Oil",
    url: "https://www.aisnakeoil.com/feed",
    description: "Critical AI analysis (Arvind Narayanan)",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "DeepLearning.AI - The Batch",
    url: "https://www.deeplearning.ai/the-batch/feed/",
    description: "Andrew Ng's weekly AI digest",
  },
  {
    topicSlug: "ai-machine-learning",
    name: "Anthropic Blog",
    url: "https://www.anthropic.com/blog/rss.xml",
    description: "AI safety and research",
  },

  // Cybersecurity
  {
    topicSlug: "cybersecurity",
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    description: "In-depth security journalism",
  },
  {
    topicSlug: "cybersecurity",
    name: "Troy Hunt",
    url: "https://www.troyhunt.com/rss/",
    description: "Breaches, HIBP, practical security",
  },
  {
    topicSlug: "cybersecurity",
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/",
    description: "Bruce Schneier's security analysis",
  },
  {
    topicSlug: "cybersecurity",
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    description: "Cybersecurity news and analysis",
  },
  {
    topicSlug: "cybersecurity",
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    description: "Enterprise security news",
  },
  {
    topicSlug: "cybersecurity",
    name: "Ars Technica - Security",
    url: "https://arstechnica.com/security/feed/",
    description: "Quality security reporting",
  },
  {
    topicSlug: "cybersecurity",
    name: "TechCrunch - Security",
    url: "https://techcrunch.com/category/security/feed/",
    description: "Startup/industry security news",
  },
  {
    topicSlug: "cybersecurity",
    name: "SANS Internet Storm Center",
    url: "https://isc.sans.edu/rssfeed.xml",
    description: "Daily threat intelligence",
  },
  {
    topicSlug: "cybersecurity",
    name: "Bleeping Computer",
    url: "https://www.bleepingcomputer.com/feed/",
    description: "Malware, vulnerabilities, security news",
  },
  {
    topicSlug: "cybersecurity",
    name: "SecurityWeek",
    url: "https://www.securityweek.com/feed/",
    description: "Security industry news and analysis",
  },

  // Web Development
  {
    topicSlug: "web-development",
    name: "Smashing Magazine",
    url: "https://www.smashingmagazine.com/feed/",
    description: "Premier web dev publication",
  },
  {
    topicSlug: "web-development",
    name: "CSS-Tricks",
    url: "https://css-tricks.com/feed/",
    description: "Frontend techniques and patterns",
  },
  {
    topicSlug: "web-development",
    name: "web.dev",
    url: "https://web.dev/feed.xml",
    description: "Web platform standards and best practices",
  },
  {
    topicSlug: "web-development",
    name: "JavaScript Weekly",
    url: "https://javascriptweekly.com/rss/",
    description: "Curated JS ecosystem news",
  },
  {
    topicSlug: "web-development",
    name: "React Blog",
    url: "https://react.dev/rss.xml",
    description: "Official React updates",
  },
  {
    topicSlug: "web-development",
    name: "Vercel Blog",
    url: "https://vercel.com/atom",
    description: "Next.js and frontend infrastructure",
  },
  {
    topicSlug: "web-development",
    name: "A List Apart",
    url: "https://alistapart.com/main/feed/",
    description: "Web standards and design",
  },
  {
    topicSlug: "web-development",
    name: "Frontend Focus",
    url: "https://frontendfoc.us/rss/",
    description: "Curated frontend newsletter",
  },
  {
    topicSlug: "web-development",
    name: "Node Weekly",
    url: "https://nodeweekly.com/rss/",
    description: "Server-side JS ecosystem",
  },
  {
    topicSlug: "web-development",
    name: "Deno Blog",
    url: "https://deno.com/blog/rss.xml",
    description: "Modern JS runtime updates",
  },

  // Cloud & DevOps
  {
    topicSlug: "cloud-devops",
    name: "Kubernetes Blog",
    url: "https://kubernetes.io/feed.xml",
    description: "Container orchestration standard",
  },
  {
    topicSlug: "cloud-devops",
    name: "Docker Blog",
    url: "https://www.docker.com/blog/feed/",
    description: "Container ecosystem",
  },
  {
    topicSlug: "cloud-devops",
    name: "Cloudflare Blog",
    url: "https://blog.cloudflare.com/rss/",
    description: "Edge/CDN engineering insights",
  },
  {
    topicSlug: "cloud-devops",
    name: "AWS News Blog",
    url: "https://aws.amazon.com/blogs/aws/feed/",
    description: "AWS news and announcements",
  },
  {
    topicSlug: "cloud-devops",
    name: "Google Cloud Blog",
    url: "https://cloud.google.com/blog/feed",
    description: "GCP updates and features",
  },
  {
    topicSlug: "cloud-devops",
    name: "HashiCorp Blog",
    url: "https://www.hashicorp.com/blog/feed.xml",
    description: "Terraform, Vault, and IaC",
  },
  {
    topicSlug: "cloud-devops",
    name: "DevOps.com",
    url: "https://devops.com/feed/",
    description: "DevOps community news",
  },
  {
    topicSlug: "cloud-devops",
    name: "The New Stack",
    url: "https://thenewstack.io/feed/",
    description: "Cloud-native ecosystem coverage",
  },
  {
    topicSlug: "cloud-devops",
    name: "CNCF Blog",
    url: "https://www.cncf.io/blog/feed/",
    description: "Cloud Native Computing Foundation",
  },
  {
    topicSlug: "cloud-devops",
    name: "Fly.io Blog",
    url: "https://fly.io/blog/feed.xml",
    description: "Modern deployment infrastructure",
  },

  // Startups & Venture Capital
  {
    topicSlug: "startups-vc",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    description: "Startup and tech news",
  },
  {
    topicSlug: "startups-vc",
    name: "Y Combinator Blog",
    url: "https://www.ycombinator.com/blog/rss/",
    description: "Top accelerator insights",
  },
  {
    topicSlug: "startups-vc",
    name: "First Round Review",
    url: "https://review.firstround.com/feed.xml",
    description: "Deep startup strategy content",
  },
  {
    topicSlug: "startups-vc",
    name: "Paul Graham Essays",
    url: "http://www.aaronsw.com/2002/feeds/pgessays.rss",
    description: "Foundational startup thinking",
  },
  {
    topicSlug: "startups-vc",
    name: "a16z Blog",
    url: "https://a16z.com/feed/",
    description: "Andreessen Horowitz insights",
  },
  {
    topicSlug: "startups-vc",
    name: "Steve Blank",
    url: "https://steveblank.com/feed/",
    description: "Lean startup methodology",
  },
  {
    topicSlug: "startups-vc",
    name: "Crunchbase News",
    url: "https://news.crunchbase.com/feed/",
    description: "Funding rounds and data",
  },
  {
    topicSlug: "startups-vc",
    name: "Stratechery",
    url: "https://stratechery.com/feed/",
    description: "Business strategy analysis",
  },
  {
    topicSlug: "startups-vc",
    name: "SaaStr",
    url: "https://www.saastr.com/feed/",
    description: "SaaS startup growth strategies",
  },
  {
    topicSlug: "startups-vc",
    name: "AVC (Fred Wilson)",
    url: "https://avc.com/feed/",
    description: "VC insights from Fred Wilson",
  },

  // Fintech & Digital Finance
  {
    topicSlug: "fintech",
    name: "Financial Times",
    url: "https://www.ft.com/?format=rss",
    description: "Global financial journalism",
  },
  {
    topicSlug: "fintech",
    name: "Bloomberg Markets",
    url: "https://feeds.bloomberg.com/markets/news.rss",
    description: "Premier financial news",
  },
  {
    topicSlug: "fintech",
    name: "WSJ Markets",
    url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    description: "Quality financial journalism",
  },
  {
    topicSlug: "fintech",
    name: "TechCrunch - Fintech",
    url: "https://techcrunch.com/category/fintech/feed/",
    description: "Fintech startup coverage",
  },
  {
    topicSlug: "fintech",
    name: "Finextra",
    url: "https://www.finextra.com/rss/headlines.aspx",
    description: "Dedicated fintech news",
  },
  {
    topicSlug: "fintech",
    name: "PYMNTS",
    url: "https://www.pymnts.com/feed/",
    description: "Payments and commerce innovation",
  },
  {
    topicSlug: "fintech",
    name: "The Economist - Finance",
    url: "https://www.economist.com/finance-and-economics/rss.xml",
    description: "Financial analysis and economics",
  },
  {
    topicSlug: "fintech",
    name: "Forbes - Fintech",
    url: "https://www.forbes.com/fintech/feed/",
    description: "Fintech industry coverage",
  },
  {
    topicSlug: "fintech",
    name: "MarketWatch",
    url: "https://www.marketwatch.com/rss/topstories",
    description: "Financial markets news",
  },
  {
    topicSlug: "fintech",
    name: "Reuters Business",
    url: "https://www.reuters.com/business/finance/rss",
    description: "Global business and finance",
  },

  // Developer Tools & Open Source
  {
    topicSlug: "developer-tools-open-source",
    name: "GitHub Blog",
    url: "https://github.blog/feed/",
    description: "Platform and ecosystem updates",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "The ReadME Project",
    url: "https://github.com/readme/feed.xml",
    description: "Open source community stories",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "GitLab Blog",
    url: "https://about.gitlab.com/atom.xml",
    description: "DevOps platform and open-core",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "JetBrains Blog",
    url: "https://blog.jetbrains.com/feed/",
    description: "IDE and developer tooling",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "The Changelog",
    url: "https://changelog.com/feed",
    description: "Open source ecosystem",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "Linux Foundation Blog",
    url: "https://www.linuxfoundation.org/blog/rss.xml",
    description: "Foundation-level open source",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "Rust Blog",
    url: "https://blog.rust-lang.org/feed.xml",
    description: "Rust language updates",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "Go Blog",
    url: "https://go.dev/blog/feed.atom",
    description: "Go language updates",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "Mozilla Hacks",
    url: "https://hacks.mozilla.org/feed/",
    description: "Web platform and open source",
  },
  {
    topicSlug: "developer-tools-open-source",
    name: "Hacker News (Best)",
    url: "https://hnrss.org/best",
    description: "Developer community signal",
  },

  // Data Science & Analytics
  {
    topicSlug: "data-science",
    name: "Towards Data Science",
    url: "https://towardsdatascience.com/feed",
    description: "Data science community articles",
  },
  {
    topicSlug: "data-science",
    name: "KDnuggets",
    url: "https://www.kdnuggets.com/feed",
    description: "Data science and ML news",
  },
  {
    topicSlug: "data-science",
    name: "Analytics Vidhya",
    url: "https://www.analyticsvidhya.com/feed/",
    description: "Data science tutorials",
  },
  {
    topicSlug: "data-science",
    name: "Data Science Central",
    url: "https://www.datasciencecentral.com/feed/",
    description: "Data science community blog",
  },
  {
    topicSlug: "data-science",
    name: "Planet PostgreSQL",
    url: "https://planet.postgresql.org/rss20.xml",
    description: "PostgreSQL community blog",
  },
  {
    topicSlug: "data-science",
    name: "Supabase Blog",
    url: "https://supabase.com/blog/rss.xml",
    description: "Modern database platform",
  },
  {
    topicSlug: "data-science",
    name: "Real Python",
    url: "https://realpython.com/atom.xml",
    description: "Python data tutorials",
  },
  {
    topicSlug: "data-science",
    name: "Dataquest Blog",
    url: "https://www.dataquest.io/blog/feed/",
    description: "Data science learning resources",
  },
  {
    topicSlug: "data-science",
    name: "Mode Analytics Blog",
    url: "https://mode.com/blog/rss.xml",
    description: "Analytics and BI insights",
  },
  {
    topicSlug: "data-science",
    name: "PlanetScale Blog",
    url: "https://planetscale.com/blog/rss.xml",
    description: "Serverless database insights",
  },

  // Sustainability & Climate Tech
  {
    topicSlug: "climate-tech",
    name: "CleanTechnica",
    url: "https://cleantechnica.com/feed/",
    description: "Clean energy news",
  },
  {
    topicSlug: "climate-tech",
    name: "TechCrunch - Climate",
    url: "https://techcrunch.com/category/climate/feed/",
    description: "Climate startup coverage",
  },
  {
    topicSlug: "climate-tech",
    name: "GreenBiz",
    url: "https://www.greenbiz.com/rss.xml",
    description: "Sustainable business",
  },
  {
    topicSlug: "climate-tech",
    name: "MIT Technology Review - Climate",
    url: "https://www.technologyreview.com/topic/climate-change/feed",
    description: "Climate tech analysis",
  },
  {
    topicSlug: "climate-tech",
    name: "Yale Climate Connections",
    url: "https://yaleclimateconnections.org/feed",
    description: "Science-backed climate reporting",
  },
  {
    topicSlug: "climate-tech",
    name: "Carbon Brief",
    url: "https://www.carbonbrief.org/feed/",
    description: "Climate science and policy",
  },
  {
    topicSlug: "climate-tech",
    name: "Canary Media",
    url: "https://www.canarymedia.com/feed",
    description: "Clean energy journalism",
  },
  {
    topicSlug: "climate-tech",
    name: "Electrek",
    url: "https://electrek.co/feed/",
    description: "EV and clean energy news",
  },
  {
    topicSlug: "climate-tech",
    name: "Grist",
    url: "https://grist.org/feed/",
    description: "Climate and environment reporting",
  },
  {
    topicSlug: "climate-tech",
    name: "Reuters - Sustainability",
    url: "https://www.reuters.com/business/sustainability/rss",
    description: "Sustainability business news",
  },

  // Blockchain & Web3
  {
    topicSlug: "blockchain-web3",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    description: "Crypto and blockchain news",
  },
  {
    topicSlug: "blockchain-web3",
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    description: "Crypto research and news",
  },
  {
    topicSlug: "blockchain-web3",
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    description: "Web3 and crypto news",
  },
  {
    topicSlug: "blockchain-web3",
    name: "Ethereum Blog",
    url: "https://blog.ethereum.org/feed.xml",
    description: "Official Ethereum foundation",
  },
  {
    topicSlug: "blockchain-web3",
    name: "CoinTelegraph",
    url: "https://cointelegraph.com/rss",
    description: "Crypto industry coverage",
  },
  {
    topicSlug: "blockchain-web3",
    name: "The Defiant",
    url: "https://thedefiant.io/feed",
    description: "DeFi and Web3 news",
  },
  {
    topicSlug: "blockchain-web3",
    name: "Bankless",
    url: "https://www.bankless.com/rss",
    description: "DeFi education and analysis",
  },
  {
    topicSlug: "blockchain-web3",
    name: "Chainlink Blog",
    url: "https://blog.chain.link/feed/",
    description: "Oracle infrastructure updates",
  },
  {
    topicSlug: "blockchain-web3",
    name: "Week in Ethereum",
    url: "https://weekinethereumnews.com/feed/",
    description: "Ethereum ecosystem digest",
  },
  {
    topicSlug: "blockchain-web3",
    name: "a16z Crypto",
    url: "https://a16zcrypto.com/feed/",
    description: "Web3 research and investment thesis",
  },
]

async function main() {
  console.log("🌱 Starting database seed...")

  // Create topics
  console.log("📁 Creating topics...")
  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: topic,
      create: topic,
    })
  }
  console.log(`✅ Created ${topics.length} topics`)

  // Create RSS feeds
  console.log("📡 Creating RSS feeds...")
  let feedCount = 0
  for (const feed of rssFeeds) {
    const topic = await prisma.topic.findUnique({
      where: { slug: feed.topicSlug },
    })

    if (topic) {
      await prisma.rssFeed.upsert({
        where: { url: feed.url },
        update: {
          name: feed.name,
          description: feed.description,
          topicId: topic.id,
        },
        create: {
          name: feed.name,
          url: feed.url,
          description: feed.description,
          topicId: topic.id,
        },
      })
      feedCount++
    }
  }
  console.log(`✅ Created ${feedCount} RSS feeds`)

  console.log("🎉 Database seed completed!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
