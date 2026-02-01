 <script>
      /* ===== STORAGE CONSTANTS ===== */
      const STORAGE_VERSION = "v444";
      const FLASH_KEY = `flashData_${STORAGE_VERSION}`;
      const STATS_KEY = `stats_${STORAGE_VERSION}`;
      const RESET_FLAG = "APP_RESET_DONE_v444";

      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }

      /* ===== SOUND ===== */

      let soundOn = JSON.parse(localStorage.getItem("soundOn") ?? "true");
      // very soft sounds

      const flipSound = new Audio(
        "https://actions.google.com/sounds/v1/impacts/metal_parts_cling.ogg",
      );
      const correctSound = new Audio(
        "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg",
      );

      flipSound.volume = 0.2;
      correctSound.volume = 0.07;

      function toggleSound() {
        soundOn = !soundOn;
        localStorage.setItem("soundOn", JSON.stringify(soundOn));
        updateSoundIcon();
      }

      function updateSoundIcon() {
        const el = document.getElementById("soundIcon");
        if (el) el.textContent = soundOn ? "🔊" : "🔇";
      }

      /* ===== DATA ===== */

      let data = JSON.parse(localStorage.getItem(FLASH_KEY)) || {
        topics: {},
      };
      let stats = JSON.parse(localStorage.getItem(STATS_KEY)) || {
        sessions: 0,
        history: [],
        perTopic: {},
        hardWords: {},
      };

      const topicSelect = document.getElementById("topicSelect");

      topicSelect.onchange = function () {
        setCurrentTopic(this.value);
      };

      const bankTopicSelect = document.getElementById("bankTopicSelect");
      const bankListTopicSelect = document.getElementById(
        "bankListTopicSelect",
      );
      bankListTopicSelect.onchange = switchBankListTopic;

      const searchInput = document.getElementById("searchInput");
      const sortSelect = document.getElementById("sortSelect");
      const wordList = document.getElementById("wordList");
      const addTopicSelect = document.getElementById("addTopicSelect");
      const learnInput = document.getElementById("learnInput");
      const translationInput = document.getElementById("translationInput");
      const newTopicInput = document.getElementById("newTopicInput");
      const importFile = document.getElementById("importFile");
      const shuffleBtn = document.getElementById("shuffleBtn");
      const card = document.getElementById("card");

      /* ===== HUB INDEX ===== */

      // state (HUB is read-only)
      let hubIndex = null;
      let currentTopic = null;

      /*
Expected structure:
{
  version: number,
  languages: [{ id, title }],
  branches: [{ id, title }],
  entries: [
    {
      branch: string,
      group: string,
      files: { [lang]: string[] }
    }
  ]
}
*/

      function loadHubIndex() {
        if (!window.HUB_INDEX) {
          alert("Word Library is not available right now.");
          return false;
        }

        const idx = window.HUB_INDEX;

        // basic shape validation
        if (
          typeof idx !== "object" ||
          !Array.isArray(idx.languages) ||
          !Array.isArray(idx.branches) ||
          !Array.isArray(idx.entries)
        ) {
          alert("Word Library is corrupted.");
          return false;
        }

        hubIndex = idx;
        return true;
      }

      /* ===== UTIL ===== */

      function save() {
        localStorage.setItem(FLASH_KEY, JSON.stringify(data));
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      }

      function setCurrentTopic(topicName) {
        currentTopic = topicName || null;

        // סנכרון UI
        if (topicSelect) topicSelect.value = topicName || "";
        if (bankTopicSelect) bankTopicSelect.value = topicName || "";
        if (bankListTopicSelect) bankListTopicSelect.value = topicName || "";
      }

      /* ===== TOPIC NAME GATE ===== */

      function normalizeTopicName(name) {
        return name
          .trim()
          .replace(/\s+/g, " ") // רווחים כפולים → רווח אחד
          .toLowerCase(); // בלי הבדל אותיות
      }

      /*
mode:
- "create"  → יצירת טופיק חדש (ADD / IMPORT / DOWNLOAD)
- "rename"  → שינוי שם טופיק
*/
      function validateTopicName(name, mode, currentName = null) {
        const n = normalizeTopicName(name);

        if (!n) {
          alert("Topic name is empty");
          return null;
        }

        // יצירת טופיק חדש
        if (mode === "create") {
          if (data.topics[n]) {
            alert(`Topic "${n}" already exists`);
            return null;
          }
          return n;
        }

        // שינוי שם
        if (mode === "rename") {
          if (n === currentName) return n; // אותו שם – מותר
          if (data.topics[n]) {
            alert(`Topic "${n}" already exists`);
            return null;
          }
          return n;
        }

        console.error("Unknown topic name validation mode:", mode);
        return null;
      }

      function allWords() {
        let a = [];
        Object.keys(data.topics).forEach((t) => {
          if (t !== "All words") a.push(...data.topics[t]);
        });
        return a;
      }

      /* ===== LIBRARY → FC TOPIC ===== */
      function saveCSVAsTopic(csvText, topicName) {
        // 🔒 חסימה מיידית – שם טופיק כבר קיים
        const checked = validateTopicName(topicName, "create");
        if (!checked) {
          alert("This file was already loaded");
          return false;
        }

        const rows = csvText.split(/\r?\n/);
        const words = [];

        rows.forEach((line) => {
          if (!line.trim()) return;

          const p = line.split(",");
          if (p.length >= 2) {
            words.push({
              id: Date.now() + Math.random(),
              learn: p[0].replace(/"/g, "").trim(),
              tr: p.slice(1).join(",").replace(/"/g, "").trim(),
            });
          }
        });

        if (words.length === 0) {
          alert("File contains no valid words");
          return false;
        }

        if (data.topics[topicName]) {
          alert("Topic already exists. File not loaded.");
          return false;
        }

        data.topics[topicName] = words;

        save();
        loadTopics();

        return true;
      }

      /* ===== NAV ===== */
      function show(id) {
        document
          .querySelectorAll(".screen")
          .forEach((s) => s.classList.remove("active"));
        document.getElementById(id).classList.add("active");
      }

      function showBank() {
        resetBankSearch();
        loadTopics();
        show("bank");
      }

      function showStats() {
        renderStats();
        show("stats");
      }
      function showContact() {
        show("contact");
      }

      function showDownload() {
        if (stats.current) {
          exitSessionSafe("download");
          return;
        }

        if (!hubIndex) return;

        // איפוס שפה
        currentDownloadLang = null;

        // איפוס בחירה וסטייל של השפה
        if (downloadLangSelect) {
          downloadLangSelect.value = "";
        }

        // בניית UI של האקורדיונים
        buildDownloadUI();

        // מצב אפור – נושאים נעולים עד בחירת שפה
        const acc = document.getElementById("downloadAccordions");
        if (acc) {
          acc.classList.add("lang-not-selected");
        }

        // עדכון סטייל של select (מוריד כל סימון קודם)
        markActiveDownloadLang();

        // סגירת כל האקורדיונים
        closeAllAccordions();

        // הצגת המסך
        show("download");
      }

      function goHome() {
        resetBankSearch();
        exitSessionSafe("home");
        loadTopics();
        updateInstructions();
      }

      /* ===== HOME LOGIC ===== */
      function updateInstructions() {
        document
          .getElementById("instructions")
          .classList.toggle("hidden", allWords().length > 0);
      }

      /* ===== TOPICS ===== */

      function loadTopics() {
        const hardLabel = "Hard Words";

        const baseTopics = Object.keys(data.topics).filter(
          (t) => t !== "All words",
        );

        const isBankEmpty = baseTopics.length === 0;

        /* ---------- HOME ---------- */
        topicSelect.innerHTML = '<option value="">Select topic</option>';
        topicSelect.innerHTML += `<option>${hardLabel}</option>`;
        baseTopics.forEach((t) => {
          topicSelect.innerHTML += `<option>${t}</option>`;
        });

        /* ---------- BANK ---------- */
        bankTopicSelect.innerHTML = '<option value="">Select topic</option>';
        baseTopics.forEach((t) => {
          bankTopicSelect.innerHTML += `<option>${t}</option>`;
        });

        /* ---------- BANK LIST ---------- */
        bankListTopicSelect.innerHTML = "";
        baseTopics.forEach((t) => {
          bankListTopicSelect.innerHTML += `<option>${t}</option>`;
        });

        if (currentTopic && baseTopics.includes(currentTopic)) {
          bankListTopicSelect.value = currentTopic;
        }

        /* ---------- EMPTY BANK GUARD ---------- */
        if (isBankEmpty) {
          topicSelect.disabled = true;
          bankTopicSelect.disabled = true;
          bankListTopicSelect.innerHTML = "";
        } else {
          topicSelect.disabled = false;
          bankTopicSelect.disabled = false;
        }
      }

      /* ===== BANK ===== */

      function resetBankSearch() {
        if (searchInput) searchInput.value = "";
        if (sortSelect) sortSelect.value = "";
      }

      function switchBankListTopic() {
        const t = bankListTopicSelect.value;
        if (!t) return;

        setCurrentTopic(t);

        if (t === "Hard Words") {
          renderHardWordsList();
          show("bankList");
          return;
        }

        renderWordList();
        show("bankList");
      }

      function renderHardWordsList() {
        wordList.innerHTML = "";

        const entries = Object.entries(stats.hardWords)
          .filter((e) => e[1] >= 2)
          .sort((a, b) => b[1] - a[1]);

        if (!entries.length) {
          wordList.innerHTML = "<p>No hard words.</p>";
          return;
        }

        entries.forEach(([key, count], i) => {
          const [learn, tr] = key.split("||");

          wordList.innerHTML += `
      <div class="list-item">
        <div class="word-line">
          ${i + 1}. ${learn} – ${tr}
        </div>
        <div class="actions">
          <button style="font-size:12px;padding:6px;"
            onclick="removeHardWord('${key.replace(/'/g, "\\'")}')">
            Remove
          </button>
          <span style="opacity:.6;font-size:12px;">${count}×</span>
        </div>
      </div>`;
        });
      }

      function removeHardWord(key) {
        if (!stats.hardWords[key]) return;

        delete stats.hardWords[key];
        save();

        renderHardWordsList();
      }

      function renameCurrentTopic() {
        if (!currentTopic || currentTopic === "All words") return;

        const oldKey = normalizeTopicName(currentTopic);
        const input = prompt("New topic name:", currentTopic);
        if (!input) return;

        const newKey = normalizeTopicName(input);

        // אותו מפתח בפועל
        if (newKey === oldKey) return;

        // קיים כבר
        if (data.topics[newKey]) {
          alert("Topic name already exists. Rename cancelled.");
          return;
        }

        // העברה
        data.topics[newKey] = data.topics[oldKey];
        delete data.topics[oldKey];

        // עדכון state
        setCurrentTopic(newKey);
        lastAddTopic = newKey;

        // סטטיסטיקה
        if (stats.perTopic[oldKey]) {
          stats.perTopic[newKey] = stats.perTopic[oldKey];
          delete stats.perTopic[oldKey];
        }
        if (stats.current && stats.current.topic === oldKey) {
          stats.current.topic = newKey;
        }

        save();
        loadTopics();
        renderWordList();
      }

      function addWordToCurrentTopic() {
        if (!currentTopic) return;

        lastAddTopic = currentTopic;
        showAdd();
      }

      bankTopicSelect.onchange = () => {
        if (!bankTopicSelect.value) return;
        setCurrentTopic(bankTopicSelect.value);
        deleteTopicBtn.classList.toggle("hidden", currentTopic === "All words");

        resetBankSearch();
        renderWordList();
        show("bankList");
      };

      function renderWordList() {
        let q = searchInput.value.toLowerCase();
        let sort = sortSelect.value;
        wordList.innerHTML = "";

        let arr = [...data.topics[currentTopic]];

        if (q) {
          arr = arr.filter(
            (w) =>
              w.learn.toLowerCase().includes(q) ||
              w.tr.toLowerCase().includes(q),
          );
        }

        if (sort === "learn") {
          arr.sort((a, b) => a.learn.localeCompare(b.learn));
        }
        if (sort === "tr") {
          arr.sort((a, b) => a.tr.localeCompare(b.tr));
        }

        arr.forEach((w, i) => {
          wordList.innerHTML += `
      <div class="list-item">
        <div class="word-line">
          ${i + 1}. ${w.learn} – ${w.tr}
        </div>
        <div class="actions">
          <button style="font-size:12px;padding:6px;" onclick="editWord(${w.id})">Edit</button>
          <button style="font-size:12px;padding:6px;" onclick="deleteWord(${w.id})">Delete</button>
        </div>
      </div>`;
        });
      }

      function exportCurrentTopic() {
        let rows = ["Learning language,Translation"];
        data.topics[currentTopic].forEach((w) =>
          rows.push(`"${w.learn}","${w.tr}"`),
        );
        let blob = new Blob([rows.join("\n")], { type: "text/csv" });
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${currentTopic}.csv`;
        a.click();
      }

      function deleteCurrentTopic() {
        if (confirm("Delete this topic and all its words?")) {
          delete data.topics[currentTopic];
          save();
          showBank();
        }
      }

      function deleteWord(id) {
        data.topics[currentTopic] = data.topics[currentTopic].filter(
          (w) => w.id !== id,
        );
        save();
        renderWordList();
      }

      function editWord(id) {
        returnToBankListAfterSave = true;
        const w = data.topics[currentTopic].find((x) => x.id === id);
        deleteWord(id);
        showAdd();
        addTopicSelect.value = currentTopic;
        onAddTopicChange();
        learnInput.value = w.learn;
        translationInput.value = w.tr;
      }
      /* ===== ADD WORD ===== */

      function showAdd() {
        resetBankSearch();

        learnInput.value = "";
        translationInput.value = "";
        newTopicInput.value = "";
        newTopicInput.disabled = true;
        newTopicInput.classList.add("hidden");

        loadAddTopics();
        show("add");
      }

      function loadAddTopics() {
        addTopicSelect.innerHTML = "";

        addTopicSelect.innerHTML += `<option value="">Select topic</option>`;
        addTopicSelect.innerHTML += `<option value="_new">+ New topic</option>`;

        Object.keys(data.topics).forEach((t) => {
          if (t !== "All words") {
            addTopicSelect.innerHTML += `<option value="${t}">${t}</option>`;
          }
        });

        if (lastAddTopic && data.topics[lastAddTopic]) {
          addTopicSelect.value = lastAddTopic;
        } else {
          addTopicSelect.value = "";
        }

        onAddTopicChange();
      }

      function onAddTopicChange() {
        const isNew = addTopicSelect.value === "_new";

        newTopicInput.disabled = !isNew;
        newTopicInput.classList.toggle("hidden", !isNew);

        if (!isNew) {
          newTopicInput.value = "";
        }
      }

      function saveWord() {
        const isNew = addTopicSelect.value === "_new";
        const topicName = isNew
          ? newTopicInput.value.trim()
          : addTopicSelect.value;

        if (!topicName) return;
        if (!learnInput.value || !translationInput.value) return;

        if (isNew && data.topics[topicName]) {
          alert("Topic already exists");
          return;
        }

        if (!data.topics[topicName]) {
          data.topics[topicName] = [];
        }

        data.topics[topicName].push({
          id: Date.now() + Math.random(),
          learn: learnInput.value,
          tr: translationInput.value,
        });

        lastAddTopic = topicName;
        setCurrentTopic(topicName);

        save();
        loadTopics();
        updateInstructions();

        learnInput.value = "";
        translationInput.value = "";
        newTopicInput.value = "";

        loadAddTopics();
        addTopicSelect.value = topicName;
        onAddTopicChange();
      }

      /* ===== IMPORT ===== */

      function triggerImport() {
        importFile.click();
      }

      importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) {
          importFile.value = "";
          return;
        }

        // 🔥 שם הנושא = שם הקובץ בלי סיומת
        const topic = file.name.replace(/\.[^/.]+$/, "");

        // יצירת נושא חדש (או ניקוי קיים) חסימת שם כפול
        const checked = validateTopicName(topic, "create");
        if (!checked) {
          importFile.value = "";
          return;
        }

        if (data.topics[topic]) {
          alert("Topic already exists. Import cancelled.");
          importFile.value = "";
          return;
        }

        data.topics[topic] = [];

        const reader = new FileReader();
        reader.onload = (ev) => {
          ev.target.result.split(/\r?\n/).forEach((line, i) => {
            if (i === 0) return;

            const p = line.split(",");
            if (p.length >= 2) {
              data.topics[topic].push({
                id: Date.now() + Math.random(),
                learn: p[0].replace(/"/g, ""),
                tr: p.slice(1).join(",").replace(/"/g, ""),
              });
            }
          });

          // 🔥 שמירה ועדכון
          save();
          loadTopics();
          updateInstructions();

          // 🔥 בחירת הנושא ופתיחת סשן אוטומטית
          setCurrentTopic(topic);

          importFile.value = "";

          startSessionSafe(topic); // 🔥 פותח סשן מייד
        };

        reader.readAsText(file, "UTF-8");
      };

      /* ===== SESSION ===== */

      // session state (single source of truth)
      let session = [];
      let current = null;
      let cardFlipped = false;
      let shuffleUsed = false;
      let sessionDefaultDirection = "A";

      function exitSessionSafe(nextScreen) {
        if (stats.current) {
          finishSessionIfActive();
        }

        if (nextScreen) {
          show(nextScreen);
        } else {
          show("home");
        }
      }

      function startSessionSafe(topicName) {
        // סגירת סשן קודם אם קיים
        if (stats.current) {
          finishSessionIfActive();
        }

        // בחירת נושא בצורה מבוקרת
        setCurrentTopic(topicName);

        startSession();
      }

      function startSession() {
        if (!currentTopic) return;

        // reset session state
        session = [];
        current = null;
        cardFlipped = false;
        shuffleUsed = false;
        sessionDefaultDirection = "A";

        // ----- HARD WORDS -----
        if (currentTopic === "Hard Words") {
          session = Object.entries(stats.hardWords)
            .filter((e) => e[1] >= 2)
            .map((e) => {
              const [learn, tr] = e[0].split("||");
              return { learn, tr };
            });

          if (session.length === 0) {
            alert("No hard words to practice yet.");
            show("home");
            return;
          }
        }
        // ----- NORMAL TOPIC -----
        else {
          if (!data.topics[currentTopic]) {
            alert("Topic not found.");
            return;
          }

          session = [...data.topics[currentTopic]];

          const sort = sortSelect.value;
          if (sort === "learn") {
            session.sort((a, b) => a.learn.localeCompare(b.learn));
          }
          if (sort === "tr") {
            session.sort((a, b) => a.tr.localeCompare(b.tr));
          }

          if (session.length === 0) {
            alert("This topic has no words.");
            show("bank");
            return;
          }
        }

        // ----- START SESSION -----
        shuffleBtn.classList.remove("hidden");

        stats.sessions++;
        stats.current = {
          topic: currentTopic,
          correct: 0,
          wrong: 0,
        };

        nextCard();
      }

      function nextCard() {
        if (session.length === 0) {
          stats.history.push(stats.current);
          stats.history = stats.history.slice(-10);

          let t = stats.current.topic;
          if (!stats.perTopic[t]) stats.perTopic[t] = { correct: 0, wrong: 0 };
          stats.perTopic[t].correct += stats.current.correct;
          stats.perTopic[t].wrong += stats.current.wrong;

          save();
          show("sessionEnd");
          return;
        }
        current = session[0];
        cardFlipped = false;
        renderCard();
        show("session");
      }

      function renderCard() {
        let side = cardFlipped
          ? sessionDefaultDirection === "A"
            ? "B"
            : "A"
          : sessionDefaultDirection;

        const text = side === "A" ? current.learn : current.tr;
        card.textContent = text;

        requestAnimationFrame(() => {
          autoFitCardText();
        });

        document.getElementById("remainingCount").textContent = session.length;
      }

      function autoFitCardText() {
        const maxFont = 102; // פי 3
        const minFont = 18;

        let size = maxFont;
        card.style.fontSize = size + "px";

        while (size > minFont) {
          card.style.fontSize = size + "px";

          // אם יש גלישה – מקטינים
          if (
            card.scrollHeight > card.clientHeight ||
            card.scrollWidth > card.clientWidth
          ) {
            size -= 2;
          } else {
            break;
          }
        }
      }

      function flipCard() {
        cardFlipped = !cardFlipped;
        if (soundOn) {
          flipSound.currentTime = 0;
          flipSound.play();
        }
        renderCard();
      }

      function flipDirection() {
        sessionDefaultDirection = sessionDefaultDirection === "A" ? "B" : "A";
        cardFlipped = false;
        renderCard();
      }

      function shuffleSession() {
        if (shuffleUsed) return;

        shuffleUsed = true;
        shuffleBtn.classList.add("hidden");

        session.sort(() => Math.random() - 0.5);

        current = session[0];
        cardFlipped = false;
        renderCard();
      }

      function markKnown() {
        if (soundOn) {
          correctSound.currentTime = 0;
          correctSound.play();
        }
        stats.current.correct++;
        session.shift();
        nextCard();
      }

      function markUnknown() {
        stats.current.wrong++;
        let key = current.learn + "||" + current.tr;
        stats.hardWords[key] = (stats.hardWords[key] || 0) + 1;
        session.push(session.shift());
        nextCard();
      }

      function finishSessionIfActive() {
        if (!stats.current) return;

        stats.history.push(stats.current);

        stats.history = stats.history.slice(-10);

        const t = stats.current.topic;
        if (!stats.perTopic[t]) {
          stats.perTopic[t] = { correct: 0, wrong: 0 };
        }

        stats.perTopic[t].correct += stats.current.correct;
        stats.perTopic[t].wrong += stats.current.wrong;

        stats.current = null;
        save();
      }

      function loadCSVToSession(csvText, topicTitle) {
        session = [];

        csvText.split(/\r?\n/).forEach((line, i) => {
          if (i === 0) return;
          const p = line.split(",");
          if (p.length >= 2) {
            session.push({
              learn: p[0].replace(/"/g, ""),
              tr: p.slice(1).join(",").replace(/"/g, ""),
            });
          }
        });

        if (session.length === 0) return;

        setCurrentTopic(topicTitle);
        sessionDefaultDirection = "A";
        cardFlipped = false;
        shuffleUsed = false;

        stats.sessions++;
        stats.current = { topic: currentTopic, correct: 0, wrong: 0 };

        nextCard();
      }

      /* ===== STATS ===== */
      function renderStats() {
        let topics = Object.keys(data.topics).length;
        let words = allWords().length;

        let topicStats = "";
        Object.keys(stats.perTopic).forEach((t) => {
          let c = stats.perTopic[t].correct;
          let w = stats.perTopic[t].wrong;
          let acc = c + w > 0 ? Math.round((c / (c + w)) * 100) : 0;
          topicStats += `
      <div class="stat-block">
        <strong>Topic: ${t}</strong><br>
        Correct: ${c}<br>
        Wrong: ${w}<br>
        Accuracy: ${acc}%
      </div>`;
        });

        const hardEntries = Object.entries(stats.hardWords)
          .filter((e) => e[1] >= 2)
          .sort((a, b) => b[1] - a[1]);

        const hardTable = hardEntries.length
          ? `
      <h3>Hard Words</h3>
      <table class="hard-table">
        <thead>
          <tr>
            <th>Word</th>
            <th>Times Wrong</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${hardEntries
            .map(([key, count]) => {
              const [learn, tr] = key.split("||");
              const safeKey = key.replace(/'/g, "\\'");
              return `
                <tr>
                  <td class="hard-word">${learn} – ${tr}</td>
                  <td class="hard-count">${count}</td>
                  <td style="text-align:right">
                    <button
                      class="button-danger"
                      style="padding:6px 10px;font-size:14px"
                      onclick="removeHardWord('${safeKey}')">
                      Remove
                    </button>
                  </td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>`
          : `<h3>Hard Words</h3><p>No hard words</p>`;

        statsContent.innerHTML = `
    <p>Topics: ${topics}</p>
    <p>Words: ${words}</p>
    <p>Sessions started: ${stats.sessions}</p>
    <hr>
    <h3>By topic</h3>
    ${topicStats || "<p>No data</p>"}
    <hr>
    ${hardTable}
  `;
      }

      function removeHardWord(key) {
        if (!stats.hardWords[key]) return;

        delete stats.hardWords[key];
        save();
        renderStats();
      }

      function resetStats() {
        if (!confirm("Reset ALL statistics?")) return;

        stats = {
          sessions: 0,
          history: [],
          perTopic: {},
          hardWords: {},
        };

        localStorage.setItem(STATS_KEY, JSON.stringify(stats));

        renderStats();
      }

      /* ===== MISC ===== */

      /* == reset == */
      async function hardReset() {
        localStorage.clear();

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }

        localStorage.setItem(RESET_FLAG, "1");
        location.reload();
      }

      function toggleAccordion(header) {
        const acc = header.parentElement;
        const container = acc.parentElement; // #downloadAccordions או #bank (אם בעתיד)

        // סגירת כל האקורדיונים באותו מסך
        container.querySelectorAll(".accordion.open").forEach((a) => {
          if (a !== acc) a.classList.remove("open");
        });

        // toggle רק של הנוכחי
        acc.classList.toggle("open");
      }

      const restartBtn = document.getElementById("restartSessionBtn");
      if (restartBtn) {
        restartBtn.onclick = () => {
          shuffleUsed = false;
          startSession();
        };
      }

      const backBtn = document.getElementById("backHomeBtn");
      if (backBtn) {
        backBtn.onclick = () => {
          goHome();
        };
      }

      /* ===== HUB → DOWNLOAD ADAPTER ===== */

      function getDownloadTree(lang) {
        if (!hubIndex || !lang) return [];

        const tree = {};

        hubIndex.entries.forEach((entry) => {
          const { branch, group, files } = entry;
          const langFiles = files?.[lang];
          if (!langFiles || !langFiles.length) return;

          if (!tree[branch]) {
            tree[branch] = {};
          }
          if (!tree[branch][group]) {
            tree[branch][group] = [];
          }

          langFiles.forEach((f) => {
            tree[branch][group].push(f);
          });
        });

        return tree;
      }

      /* ===== DOWNLOAD ===== */

      async function buildDownloadUI() {
        if (!hubIndex || !currentDownloadLang) return;

        const tree = getDownloadTree(currentDownloadLang);
        const container = document.getElementById("downloadAccordions");
        container.innerHTML = "";

        Object.keys(tree).forEach((branchId) => {
          const acc = document.createElement("div");
          acc.className = "accordion";

          acc.innerHTML = `
      <div class="accordion-header" onclick="toggleAccordion(this)">
        ${branchId} <span>▶</span>
      </div>
      <div class="accordion-content"></div>
    `;

          const content = acc.querySelector(".accordion-content");

          Object.keys(tree[branchId]).forEach((groupId) => {
            const groupDiv = document.createElement("div");
            groupDiv.className = "download-group";
            groupDiv.innerHTML = `<strong>${groupId}</strong>`;

            const ul = document.createElement("ul");

            tree[branchId][groupId].forEach((fileName) => {
              const li = document.createElement("li");
              li.className = "li-available";
              li.textContent = fileName.replace(/\.csv$/i, "");

              li.onclick = () => {
                const path = `hub/${currentDownloadLang}/${branchId}/${groupId}/${fileName}`;
                onDownloadFile(path, `${groupId}`, fileName);
              };

              ul.appendChild(li);
            });

            groupDiv.appendChild(ul);
            content.appendChild(groupDiv);
          });

          container.appendChild(acc);
        });
      }

      async function onDownloadFile(path, groupId, fileName) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const res = await fetch(path, { signal: controller.signal });
          if (!res.ok) {
            alert("File not found");
            return;
          }

          const csvText = await res.text();

          // Topic name יציב וברור
          const baseName = fileName.replace(/\.csv$/i, "");
          const appTopicName = `${groupId} · ${baseName}`;

          // ניסיון יצירה
          const ok = saveCSVAsTopic(csvText, appTopicName);
          if (!ok) return;

          // בחירה + פתיחת סשן
          setCurrentTopic(appTopicName);
          startSessionSafe(appTopicName);
        } catch (e) {
          alert("Download failed or timed out.");
        } finally {
          clearTimeout(timeoutId);
        }
      }

      /* ===== DOWNLOAD LANGUAGE SELECTION ===== */

      let currentDownloadLang = null;
      const downloadLangSelect = document.getElementById("downloadLangSelect");

      if (downloadLangSelect) {
        downloadLangSelect.addEventListener("change", () => {
          currentDownloadLang = downloadLangSelect.value || null;
          markActiveDownloadLang();
          buildDownloadUI();
          closeAllAccordions();
        });
      }

      function markActiveDownloadLang() {
        downloadLangSelect.classList.remove(
          "lang-he-en",
          "lang-pl-en",
          "lang-ar-he",
          "lang-es-he",
        );

        const acc = document.getElementById("downloadAccordions");

        if (currentDownloadLang) {
          downloadLangSelect.classList.add("lang-" + currentDownloadLang);
          if (acc) acc.classList.remove("lang-not-selected");
        } else {
          if (acc) acc.classList.add("lang-not-selected");
        }
      }

      function closeAllAccordions() {
        document
          .querySelectorAll("#download .accordion.open")
          .forEach((acc) => acc.classList.remove("open"));
      }

      function exitApp() {
        // PWA / Mobile
        if (navigator.userAgent.includes("Android")) {
          navigator.app?.exitApp?.();
        }

        // דפדפן רגיל – חזרה אחורה
        window.history.back();
      }

      function gateUntilReset() {
        if (localStorage.getItem(RESET_FLAG)) return;

        document
          .querySelectorAll(".screen")
          .forEach((s) => s.classList.remove("active"));

        document.getElementById("resetGate").classList.add("active");
      }

      /* ===== GLOBAL EXPORTS (for inline onclick) ===== */

      window.startSessionSafe = startSessionSafe;
      window.showStats = showStats;
      window.showBank = showBank;
      window.showDownload = showDownload;
      window.goHome = goHome;

      window.flipCard = flipCard;
      window.markKnown = markKnown;
      window.markUnknown = markUnknown;
      window.shuffleSession = shuffleSession;

      window.toggleAccordion = toggleAccordion;
      window.removeHardWord = removeHardWord;
      window.exitApp = exitApp;

      /* ===== INIT ===== */

      (() => {
        gateUntilReset();

        loadHubIndex();

        loadTopics();
        updateInstructions();
      })();
    </script>
  