# 🧩 Bloxely — Build Your Focus, Block by Block  

Bloxely is a **focus dashboard** designed to keep things simple and distraction-free.  
It’s not as overwhelming as Notion, and not as limited as sticky notes — instead, you create your own personalized dashboard with only the tools you need.  

With **Bloxely**, you stay productive by focusing on what matters today, not everything at once.  

---

## ✨ Features  

Bloxely provides a collection of **widgets (blocks)** you can mix, match, resize, and move around to build your perfect dashboard:  

- ✅ **To-Do List** — track your daily tasks  
- ✅ **Kanban Board** — manage progress visually  
- ✅ **Priority Matrix** — focus on urgent vs important work  
- ✅ **Sticky Notes** — capture quick thoughts and reminders  
- ✅ **Notes with Voice Support** — write or record your notes easily  
- ✅ **Habit Tracker** — build consistency with daily routines  
- ✅ **Minimal Calendar** — keep an eye on upcoming tasks and events  
- ✅ **Pomodoro Timer** — stay productive with work/break cycles  
- ✅ **Clock & Date** — keep track of time  
- ✅ **YouTube Player (Lofi music)** — stay in flow with background music  
- ✅ **Image & Screenshot Support** — attach visuals to your workflow  
- ✅ **Custom Wallpapers** — personalize your workspace  
- ✅ **Zoomable Dashboard** — expand your space when needed  

Each widget is **lightweight** and saves data locally, so you don’t need a heavy backend or complex setup.  

---

## 🚀 Getting Started  

Follow these steps to run Bloxely on your machine:  

## 🚀 Getting Started  

### 1. Clone the Repository  

```bash
git clone https://github.com/BuiltByDeep/bloxely.git
cd bloxely
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Open in Browser

Visit:
👉 [http://localhost:3000](http://localhost:3000)


---

## 🎯 How to Use

1. Open Bloxely in your browser.
2. Add the widgets (blocks) you need for today — such as a to-do list, Kanban board, or Pomodoro timer.
3. Resize and arrange blocks to create your personalized dashboard.
4. Use the **priority matrix** and **habit tracker** to keep long-term goals in sight.
5. Stay in focus mode with **lofi music** and the **Pomodoro timer**.
6. Personalize your space with custom wallpapers, images, or screenshots.
7. Zoom out when you need more space on the dashboard.

Everything is stored locally, so your data stays private and lightweight.

---

## 🌱 Inspiration

I’ve always struggled with focus. Most dashboards show too much and make me lose clarity, while sticky notes are too simple to manage real tasks. I kept asking myself: *what if I only saw the top priorities for today and nothing else?*

I tried it first with a notebook. I focused on just one or two things, and my productivity improved dramatically. That experiment became the seed for **Bloxely**.

Bloxely is about helping you block out distractions and build a dashboard that adapts to your workflow — not the other way around.

---

## 🛠️ Built With

* [Kiro](https://kiro.dev) — Spec-driven agentic IDE that accelerated development
* React + Tailwind — clean and responsive UI
* Local Storage — data persistence without a heavy backend

### Bloxely 2.0 AI planning setup

Plan generation runs in a Netlify Function at `/.netlify/functions/generate-workspace-plan`. Bloxely AI sends the brain dump to the configured provider through that function. For the current Gemini provider, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY=<your key>` for the **Functions** runtime in Netlify's environment settings. `GEMINI_MODEL=gemini-3.5-flash-lite` is optional because that is the fallback verified in the live planning flow; another supported Interactions model can be configured with the same variable. AI credentials stay server-side; never put a real key in the frontend or commit it. See `bloxely-dashboard/.env.example` for placeholders.

For local AI planning, run the app through Netlify Dev with those variables in its environment. A plain Vite dev server does not serve Netlify Functions. If the function is unavailable, the brain dump screen offers **Use basic planner** after a failed request. Automated tests mock the provider and need no API key.

The planning function keeps the 5,000-character brain-dump and 12,000-character JSON-body limits. Its Netlify rate rule blocks more than 10 requests per IP and domain in 60 seconds with a platform HTTP 429. Gemini 429 responses that reach the function return a typed `AI_RATE_LIMITED` error; the frontend shows its existing safe failure message for both. Netlify's edge block has no application JSON body, and enforcement can lag by up to 10 seconds. Before a fully public launch, verify the rule appears in Netlify's deploy post-processing log and add platform-level spend/abuse controls appropriate to expected traffic; the per-IP rule is not a global cost ceiling. No in-memory limiter is used.

---

## ⚡ Challenges & Learnings

* **Challenge:** Keeping the design minimal but still useful
* **Challenge:** Managing local data storage reliably
* **Challenge:** Avoiding feature bloat and keeping the tool focused
* **Learning:** Productivity is about focus, not more features
* **Learning:** Modular, block-based design makes it easy to expand without clutter


---

## 🔮 Future Roadmap

* Cloud sync for multiple devices
* Widget marketplace for community-built blocks
* AI-assisted focus recommendations

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙌 Acknowledgements

Special thanks to **Kiro** for making the build process faster, cleaner, and more structured. Without it, Bloxely would have taken much longer to bring to life.

---



