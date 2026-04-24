require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
  override: true,
});
const mongoose = require("mongoose");
const User = require("../models/User");
const AttackLog = require("../models/AttackLog");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/honeypot_analyzer";

const SAMPLE = [
  {
    ip: "198.51.100.10",
    country: "United States",
    countryCode: "US",
    city: "Sample City",
    lat: 37.7749,
    lon: -122.4194,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
    browser: "Firefox 115",
    os: "Windows 10",
    method: "POST",
    path: "/trap/login",
    trapPage: "login",
    trapAction: "login_fail",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    query: {},
    body: { username: "admin", password: "[redacted]" },
    attackTypes: ["brute_force"],
    classification: "malicious",
    riskScore: 78,
    rateCount: 12,
    rateAnomaly: "suspicious",
    bruteForce: true,
  },
  {
    ip: "203.0.113.50",
    country: "Germany",
    countryCode: "DE",
    city: "Berlin",
    lat: 52.52,
    lon: 13.405,
    userAgent: "curl/8.4.0",
    browser: "curl",
    os: "Unknown",
    method: "POST",
    path: "/trap/query",
    trapPage: "db",
    trapAction: "fake_query",
    headers: {},
    query: {},
    body: { q: "SELECT * FROM users WHERE id = 1 OR 1=1" },
    attackTypes: ["sql_injection"],
    classification: "malicious",
    riskScore: 88,
    rateCount: 3,
    rateAnomaly: "none",
    bruteForce: false,
  },
  {
    ip: "192.0.2.1",
    country: "Local",
    countryCode: "LOC",
    city: "Private network",
    lat: null,
    lon: null,
    userAgent: "Mozilla/5.0",
    browser: "Unknown",
    os: "Unknown",
    method: "GET",
    path: "/trap/db",
    trapPage: "db",
    trapAction: "page_view",
    headers: {},
    query: {},
    body: {},
    attackTypes: [],
    classification: "normal",
    riskScore: 5,
    rateCount: 1,
    rateAnomaly: "none",
    bruteForce: false,
  },
  {
    ip: "198.51.100.77",
    country: "Brazil",
    countryCode: "BR",
    city: "São Paulo",
    lat: -23.5505,
    lon: -46.6333,
    userAgent: "Mozilla/5.0 (compatible; Scanner/1.0)",
    browser: "Unknown",
    os: "Unknown",
    method: "POST",
    path: "/trap/login",
    trapPage: "login",
    trapAction: "login_fail",
    headers: {},
    query: {},
    body: { username: "<script>alert(1)</script>", password: "[redacted]" },
    attackTypes: ["xss"],
    classification: "malicious",
    riskScore: 72,
    rateCount: 5,
    rateAnomaly: "none",
    bruteForce: false,
  },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  const email = (process.env.ADMIN_EMAIL || "admin@honeypot.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "root123";

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      passwordHash: await User.hashPassword(password),
    });
    console.log("Created admin:", email);
  } else {
    user.passwordHash = await User.hashPassword(password);
    await user.save();
    console.log("Admin password reset:", email);
  }

  const count = await AttackLog.countDocuments();
  if (count === 0) {
    await AttackLog.insertMany(SAMPLE);
    console.log("Inserted sample attack logs:", SAMPLE.length);
  } else {
    console.log("Attack logs already present, skipping sample insert");
  }

  await mongoose.disconnect();
  console.log("Seed done. Login with:", email, "/", password);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
