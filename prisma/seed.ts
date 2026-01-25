import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const topics = [
  {
    name: "Artificial Intelligence",
    slug: "artificial-intelligence",
    description: "AI, Machine Learning, and Deep Learning news and research",
    icon: "brain",
  },
  {
    name: "Web Development",
    slug: "web-development",
    description: "Frontend, backend, and full-stack development",
    icon: "code",
  },
  {
    name: "Cloud Computing",
    slug: "cloud-computing",
    description: "AWS, Azure, GCP, and cloud infrastructure",
    icon: "cloud",
  },
  {
    name: "Cybersecurity",
    slug: "cybersecurity",
    description: "Security news, vulnerabilities, and best practices",
    icon: "shield",
  },
  {
    name: "Data Science",
    slug: "data-science",
    description: "Analytics, statistics, and data engineering",
    icon: "chart",
  },
  {
    name: "DevOps",
    slug: "devops",
    description: "CI/CD, containers, and infrastructure automation",
    icon: "settings",
  },
  {
    name: "Blockchain",
    slug: "blockchain",
    description: "Crypto, Web3, and decentralized technologies",
    icon: "link",
  },
  {
    name: "Mobile Development",
    slug: "mobile-development",
    description: "iOS, Android, and cross-platform development",
    icon: "smartphone",
  },
  {
    name: "Startup & Entrepreneurship",
    slug: "startup-entrepreneurship",
    description: "Startup news, funding, and business strategies",
    icon: "rocket",
  },
  {
    name: "Product Management",
    slug: "product-management",
    description: "Product strategy, roadmaps, and user research",
    icon: "target",
  },
  {
    name: "Design & UX",
    slug: "design-ux",
    description: "UI/UX design, user experience, and design systems",
    icon: "palette",
  },
  {
    name: "Open Source",
    slug: "open-source",
    description: "Open source projects, communities, and contributions",
    icon: "github",
  },
  {
    name: "Programming Languages",
    slug: "programming-languages",
    description: "TypeScript, Python, Rust, Go, and more",
    icon: "terminal",
  },
  {
    name: "Tech Industry",
    slug: "tech-industry",
    description: "Big tech news, acquisitions, and industry trends",
    icon: "building",
  },
  {
    name: "Databases",
    slug: "databases",
    description: "SQL, NoSQL, and database architecture",
    icon: "database",
  },
  {
    name: "Career & Learning",
    slug: "career-learning",
    description: "Tech careers, interviews, and continuous learning",
    icon: "graduation",
  },
]

const rssFeeds = [
  // Artificial Intelligence
  {
    topicSlug: "artificial-intelligence",
    name: "MIT Technology Review - AI",
    url: "https://www.technologyreview.com/feed/",
    description: "MIT Technology Review AI coverage",
  },
  {
    topicSlug: "artificial-intelligence",
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss/",
    description: "Official OpenAI blog",
  },
  {
    topicSlug: "artificial-intelligence",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    description: "Google AI research and announcements",
  },
  {
    topicSlug: "artificial-intelligence",
    name: "Towards Data Science - AI",
    url: "https://towardsdatascience.com/feed",
    description: "AI articles from Towards Data Science",
  },
  {
    topicSlug: "artificial-intelligence",
    name: "The Batch - DeepLearning.AI",
    url: "https://www.deeplearning.ai/the-batch/feed/",
    description: "Weekly AI newsletter by Andrew Ng",
  },

  // Web Development
  {
    topicSlug: "web-development",
    name: "CSS-Tricks",
    url: "https://css-tricks.com/feed/",
    description: "CSS and web development tips",
  },
  {
    topicSlug: "web-development",
    name: "Smashing Magazine",
    url: "https://www.smashingmagazine.com/feed/",
    description: "Web design and development articles",
  },
  {
    topicSlug: "web-development",
    name: "Dev.to",
    url: "https://dev.to/feed",
    description: "Community-driven developer content",
  },
  {
    topicSlug: "web-development",
    name: "JavaScript Weekly",
    url: "https://javascriptweekly.com/rss/",
    description: "Weekly JavaScript news",
  },
  {
    topicSlug: "web-development",
    name: "React Blog",
    url: "https://react.dev/rss.xml",
    description: "Official React blog",
  },

  // Cloud Computing
  {
    topicSlug: "cloud-computing",
    name: "AWS News Blog",
    url: "https://aws.amazon.com/blogs/aws/feed/",
    description: "Official AWS news and announcements",
  },
  {
    topicSlug: "cloud-computing",
    name: "Google Cloud Blog",
    url: "https://cloud.google.com/blog/feed",
    description: "Google Cloud Platform updates",
  },
  {
    topicSlug: "cloud-computing",
    name: "Azure Blog",
    url: "https://azure.microsoft.com/en-us/blog/feed/",
    description: "Microsoft Azure news",
  },
  {
    topicSlug: "cloud-computing",
    name: "The Cloudflare Blog",
    url: "https://blog.cloudflare.com/rss/",
    description: "Cloudflare engineering and product updates",
  },
  {
    topicSlug: "cloud-computing",
    name: "Vercel Blog",
    url: "https://vercel.com/atom",
    description: "Vercel platform and Next.js updates",
  },

  // Cybersecurity
  {
    topicSlug: "cybersecurity",
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    description: "In-depth security news and investigation",
  },
  {
    topicSlug: "cybersecurity",
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    description: "Cybersecurity news and analysis",
  },
  {
    topicSlug: "cybersecurity",
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/",
    description: "Bruce Schneier's security blog",
  },
  {
    topicSlug: "cybersecurity",
    name: "SANS Internet Storm Center",
    url: "https://isc.sans.edu/rssfeed.xml",
    description: "Daily security threat updates",
  },
  {
    topicSlug: "cybersecurity",
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    description: "Enterprise security news",
  },

  // Data Science
  {
    topicSlug: "data-science",
    name: "KDnuggets",
    url: "https://www.kdnuggets.com/feed",
    description: "Data science and machine learning news",
  },
  {
    topicSlug: "data-science",
    name: "Data Science Central",
    url: "https://www.datasciencecentral.com/feed/",
    description: "Data science community blog",
  },
  {
    topicSlug: "data-science",
    name: "Analytics Vidhya",
    url: "https://www.analyticsvidhya.com/feed/",
    description: "Data science tutorials and articles",
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

  // DevOps
  {
    topicSlug: "devops",
    name: "DevOps.com",
    url: "https://devops.com/feed/",
    description: "DevOps news and best practices",
  },
  {
    topicSlug: "devops",
    name: "Docker Blog",
    url: "https://www.docker.com/blog/feed/",
    description: "Container and Docker updates",
  },
  {
    topicSlug: "devops",
    name: "Kubernetes Blog",
    url: "https://kubernetes.io/feed.xml",
    description: "Official Kubernetes blog",
  },
  {
    topicSlug: "devops",
    name: "HashiCorp Blog",
    url: "https://www.hashicorp.com/blog/feed.xml",
    description: "Terraform, Vault, and more",
  },
  {
    topicSlug: "devops",
    name: "CircleCI Blog",
    url: "https://circleci.com/blog/feed.xml",
    description: "CI/CD and automation insights",
  },

  // Blockchain
  {
    topicSlug: "blockchain",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    description: "Cryptocurrency and blockchain news",
  },
  {
    topicSlug: "blockchain",
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    description: "Crypto research and news",
  },
  {
    topicSlug: "blockchain",
    name: "Ethereum Blog",
    url: "https://blog.ethereum.org/feed.xml",
    description: "Official Ethereum foundation blog",
  },
  {
    topicSlug: "blockchain",
    name: "a]0x Blog",
    url: "https://blog.0x.org/rss/",
    description: "DeFi and Web3 development",
  },
  {
    topicSlug: "blockchain",
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    description: "Web3 and crypto news",
  },

  // Mobile Development
  {
    topicSlug: "mobile-development",
    name: "Android Developers Blog",
    url: "https://android-developers.googleblog.com/feeds/posts/default",
    description: "Official Android development blog",
  },
  {
    topicSlug: "mobile-development",
    name: "Swift by Sundell",
    url: "https://www.swiftbysundell.com/rss",
    description: "Swift and iOS development",
  },
  {
    topicSlug: "mobile-development",
    name: "Ray Wenderlich",
    url: "https://www.raywenderlich.com/feed",
    description: "Mobile development tutorials",
  },
  {
    topicSlug: "mobile-development",
    name: "Flutter Blog",
    url: "https://medium.com/feed/flutter",
    description: "Official Flutter updates",
  },
  {
    topicSlug: "mobile-development",
    name: "React Native Blog",
    url: "https://reactnative.dev/blog/rss.xml",
    description: "React Native updates",
  },

  // Startup & Entrepreneurship
  {
    topicSlug: "startup-entrepreneurship",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    description: "Startup and tech news",
  },
  {
    topicSlug: "startup-entrepreneurship",
    name: "Y Combinator Blog",
    url: "https://www.ycombinator.com/blog/rss/",
    description: "YC startup insights",
  },
  {
    topicSlug: "startup-entrepreneurship",
    name: "First Round Review",
    url: "https://review.firstround.com/feed.xml",
    description: "Startup advice and insights",
  },
  {
    topicSlug: "startup-entrepreneurship",
    name: "Paul Graham Essays",
    url: "http://www.aaronsw.com/2002/feeds/pgessays.rss",
    description: "Essays by Paul Graham",
  },
  {
    topicSlug: "startup-entrepreneurship",
    name: "A16Z Blog",
    url: "https://a16z.com/feed/",
    description: "Andreessen Horowitz insights",
  },

  // Product Management
  {
    topicSlug: "product-management",
    name: "Mind the Product",
    url: "https://www.mindtheproduct.com/feed/",
    description: "Product management community",
  },
  {
    topicSlug: "product-management",
    name: "Product Hunt Blog",
    url: "https://blog.producthunt.com/feed",
    description: "Product launches and trends",
  },
  {
    topicSlug: "product-management",
    name: "Intercom Blog",
    url: "https://www.intercom.com/blog/feed/",
    description: "Product and customer engagement",
  },
  {
    topicSlug: "product-management",
    name: "Amplitude Blog",
    url: "https://amplitude.com/blog/rss.xml",
    description: "Product analytics insights",
  },
  {
    topicSlug: "product-management",
    name: "Lenny's Newsletter",
    url: "https://www.lennysnewsletter.com/feed",
    description: "Product management advice",
  },

  // Design & UX
  {
    topicSlug: "design-ux",
    name: "UX Collective",
    url: "https://uxdesign.cc/feed",
    description: "UX design articles and resources",
  },
  {
    topicSlug: "design-ux",
    name: "Nielsen Norman Group",
    url: "https://www.nngroup.com/feed/rss/",
    description: "UX research and insights",
  },
  {
    topicSlug: "design-ux",
    name: "A List Apart",
    url: "https://alistapart.com/main/feed/",
    description: "Web design and development",
  },
  {
    topicSlug: "design-ux",
    name: "Designmodo",
    url: "https://designmodo.com/feed/",
    description: "Web design resources",
  },
  {
    topicSlug: "design-ux",
    name: "UX Planet",
    url: "https://uxplanet.org/feed",
    description: "UX design community blog",
  },

  // Open Source
  {
    topicSlug: "open-source",
    name: "GitHub Blog",
    url: "https://github.blog/feed/",
    description: "GitHub platform updates",
  },
  {
    topicSlug: "open-source",
    name: "The ReadME Project",
    url: "https://github.com/readme/feed.xml",
    description: "Open source community stories",
  },
  {
    topicSlug: "open-source",
    name: "Open Source Initiative",
    url: "https://opensource.org/feed",
    description: "Open source news and advocacy",
  },
  {
    topicSlug: "open-source",
    name: "Linux Foundation Blog",
    url: "https://www.linuxfoundation.org/blog/rss.xml",
    description: "Linux and open source projects",
  },
  {
    topicSlug: "open-source",
    name: "Mozilla Hacks",
    url: "https://hacks.mozilla.org/feed/",
    description: "Web platform and Firefox updates",
  },

  // Programming Languages
  {
    topicSlug: "programming-languages",
    name: "The Go Blog",
    url: "https://go.dev/blog/feed.atom",
    description: "Official Go programming blog",
  },
  {
    topicSlug: "programming-languages",
    name: "Rust Blog",
    url: "https://blog.rust-lang.org/feed.xml",
    description: "Official Rust language blog",
  },
  {
    topicSlug: "programming-languages",
    name: "Python Insider",
    url: "https://blog.python.org/feeds/posts/default",
    description: "Python core development news",
  },
  {
    topicSlug: "programming-languages",
    name: "TypeScript Blog",
    url: "https://devblogs.microsoft.com/typescript/feed/",
    description: "TypeScript updates",
  },
  {
    topicSlug: "programming-languages",
    name: "Real Python",
    url: "https://realpython.com/atom.xml",
    description: "Python tutorials and tips",
  },

  // Tech Industry
  {
    topicSlug: "tech-industry",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    description: "Tech news and reviews",
  },
  {
    topicSlug: "tech-industry",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    description: "Technology news and analysis",
  },
  {
    topicSlug: "tech-industry",
    name: "Wired",
    url: "https://www.wired.com/feed/rss",
    description: "Tech culture and innovation",
  },
  {
    topicSlug: "tech-industry",
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    description: "Top stories from Hacker News",
  },
  {
    topicSlug: "tech-industry",
    name: "Benedict Evans",
    url: "https://www.ben-evans.com/benedictevans?format=rss",
    description: "Tech industry analysis",
  },

  // Databases
  {
    topicSlug: "databases",
    name: "Planet PostgreSQL",
    url: "https://planet.postgresql.org/rss20.xml",
    description: "PostgreSQL community blog",
  },
  {
    topicSlug: "databases",
    name: "MongoDB Blog",
    url: "https://www.mongodb.com/blog/rss",
    description: "MongoDB updates and tutorials",
  },
  {
    topicSlug: "databases",
    name: "Redis Blog",
    url: "https://redis.io/blog/feed/",
    description: "Redis news and tutorials",
  },
  {
    topicSlug: "databases",
    name: "PlanetScale Blog",
    url: "https://planetscale.com/blog/rss.xml",
    description: "Serverless database insights",
  },
  {
    topicSlug: "databases",
    name: "Supabase Blog",
    url: "https://supabase.com/blog/rss.xml",
    description: "Supabase and Postgres updates",
  },

  // Career & Learning
  {
    topicSlug: "career-learning",
    name: "freeCodeCamp",
    url: "https://www.freecodecamp.org/news/rss/",
    description: "Free coding tutorials",
  },
  {
    topicSlug: "career-learning",
    name: "The Pragmatic Engineer",
    url: "https://newsletter.pragmaticengineer.com/feed",
    description: "Engineering career insights",
  },
  {
    topicSlug: "career-learning",
    name: "Coding Horror",
    url: "https://blog.codinghorror.com/rss/",
    description: "Jeff Atwood's programming blog",
  },
  {
    topicSlug: "career-learning",
    name: "Joel on Software",
    url: "https://www.joelonsoftware.com/feed/",
    description: "Software development and management",
  },
  {
    topicSlug: "career-learning",
    name: "Scott Hanselman",
    url: "https://feeds.hanselman.com/ScottHanselman",
    description: "Developer productivity and career",
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
