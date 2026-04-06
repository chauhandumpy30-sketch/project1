# AquaSave

Live demo:
[AquaSave](https://aquasave0.netlify.app)

> A water-conservation education platform with interactive tools, practical tips, and API-backed experiences that help people understand and reduce their water footprint.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?logo=netlify&logoColor=white)

---

## Features

- **Water Facts** - Key statistics about global water usage and scarcity.
- **Source-Backed Calculator** - Calculates household water footprint using sourced benchmark data.
- **Quick Quiz** - Randomized questions from a curated 10-question quiz round.
- **Leaderboard** - Persistent score tracking through the backend API.
- **Nearby Reports Map** - View and submit water-wastage reports using geolocation and Leaflet.
- **Social Sharing** - Share calculator and quiz results through common social platforms.
- **Conservation Tips and Checklist** - Practical water-saving actions for daily life.
- **Responsive Design** - Works across desktop and mobile screens.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend (local) | Node.js, Express |
| Backend (deployed) | Netlify Functions |
| Maps | Leaflet + OpenStreetMap |
| Data | Local JSON files |

---

## Project Structure

```text
wp_mini_project/
|-- index.html
|-- leaderboard.html
|-- styles.css
|-- script.js
|-- package.json
|-- netlify.toml
|-- data/
|   |-- calculator-sources.json
|   |-- quiz-questions.json
|   |-- quiz-leaderboard.json
|   `-- wastage-reports.json
|-- server/
|   |-- server.js
|   `-- package.json
`-- netlify/functions/
    |-- calculator-metadata.js
    |-- gemini.js
    |-- quiz-leaderboard.js
    |-- quiz-questions.js
    |-- quiz-submit-score.js
    |-- shared.js
    `-- wastage-reports.js
```


---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- Optional: [Netlify CLI](https://docs.netlify.com/cli/get-started/) for local serverless testing

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/aquasave.git
cd aquasave
```

### 2. Install dependencies

```bash
npm install
cd server
npm install
```

### 3. Run locally

Option A - Express server:

```bash
cd server
node server.js
```

Open `http://localhost:3000`.

Option B - Netlify Dev:

```bash
netlify dev
```

Open `http://localhost:8888`.

> Do not open `index.html` directly as a `file://` URL. The calculator, quiz, leaderboard, and reports features rely on API endpoints.

---

## Deployment

### Netlify

1. Push the repository to GitHub.
2. Import the repository into Netlify.
3. Use the settings from `netlify.toml`.
4. Deploy the site.

### Other Platforms

- **Vercel** - Adapt the serverless functions to Vercel API routes.
- **GitHub Pages** - Frontend only; API features require a separate backend.
- **Railway / Render** - Run the Express server in `server/` as the backend.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calculator-metadata` | Calculator factors with source provenance |
| GET | `/api/quiz/questions?count=10` | Curated quiz questions |
| GET | `/api/quiz/leaderboard` | Top leaderboard entries |
| POST | `/api/quiz/submit-score` | Save a quiz score |
| GET | `/api/wastage-reports?lat=...&lng=...&radiusKm=5` | Nearby reports by location |
| POST | `/api/wastage-reports` | Submit a new report |

---

## Customization

- **Quiz bank** - Edit `data/quiz-questions.json`.
- **Calculator factors** - Edit `data/calculator-sources.json`.
- **Stored reports** - Edit `data/wastage-reports.json`.
- **Persistence layer** - Replace JSON files with a database for production use.

---

## Team

Designed and developed by **Ramakant Shrivastava**, **Priyanshu chauhan **, **Harsh Gaikwad**, and **Swaraj Patil**.

## License

MIT License.
