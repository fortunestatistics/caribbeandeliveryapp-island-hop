# Here are your Instructions
# About Me

Hi, I'm **Tracy Fortune**, Founder & CEO of **IslandHop Technologies Ltd.**, a Caribbean technology startup focused on transforming commerce, logistics, transportation, and financial services across the region.

With a background in healthcare and over seven years of experience in patient care and operations, I developed a passion for solving real-world problems through technology. Today, I'm building innovative platforms designed specifically for Caribbean markets, creating opportunities for businesses, independent workers, and communities.

## 🚀 Current Projects

### IslandHop

A Caribbean-focused commerce platform connecting customers, merchants, drivers, and service providers through:

* Food Delivery
* Grocery Delivery
* Courier Services
* Transportation Services
* Merchant Marketplace Solutions

### CariPay

A next-generation digital wallet and payment ecosystem designed for the Caribbean and emerging markets featuring:

* Multi-Currency Support
* Digital Payments
* Merchant Solutions
* Cross-Border Transactions
* Blockchain & Financial Technology Integration

## 🌎 Mission

To build technology that empowers Caribbean communities, supports local businesses, creates economic opportunities, and modernizes regional commerce.

## 🛠️ Interests

* Software Development
* FinTech
* Logistics Technology
* Blockchain Technology
* Artificial Intelligence
* Digital Payments
* Startup Building
* Caribbean Innovation

## 📈 Vision

Building the digital infrastructure that powers the future of Caribbean commerce.

## 🤝 Let's Connect

I'm always interested in connecting with:

* Developers
* Entrepreneurs
* Investors
* FinTech Professionals
* Logistics & Mobility Experts
* Caribbean Innovators

### Contact

📧 [investors@islandhoptt.com](mailto:investors@islandhoptt.com)
📧 [tracyfortune@islandhoptt.com](mailto:tracyfortune@islandhoptt.com)

🌐 [IslandHop Technologies](https://www.islandhoptt.com?utm_source=chatgpt.com)

---

## 📱 Android App (Google Play)

The IslandHop Android app is built with [Capacitor](https://capacitorjs.com/) on top of a React web frontend.

### Building a signed AAB for Google Play (CI)

A GitHub Actions workflow (`.github/workflows/android-build.yml`) automatically produces a signed **Android App Bundle** (`.aab`) on every push to `main` and on manual trigger.

#### Required GitHub Secrets

Add these four secrets in **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret name | Description |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded upload keystore (`.jks` file) |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the keystore |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Password for the key |

To generate the base64 value from your keystore:
```bash
# macOS
base64 -i islandhop-upload.jks | pbcopy

# Linux
base64 -w 0 islandhop-upload.jks
```

Once the secrets are set, the workflow uploads `app-release.aab` as the `app-release-aab` artifact in the Actions run. Download it and upload directly to Google Play Console.

#### Local builds

See [`frontend/android/SIGNING_README.md`](frontend/android/SIGNING_README.md) for local build instructions and [`frontend/android/BUILD_AAB.md`](frontend/android/BUILD_AAB.md) for Play Console upload steps.
