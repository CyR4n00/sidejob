// ==========================================
// Content Alchemist - Game Logic & SaaS Core
// ==========================================

// --- Supabase Client Initialization ---
const SUPABASE_URL = "https://gezgodtoczchojawxdds.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlemdvZHRvY3pjaG9qYXd4ZGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Njg0MzEsImV4cCI6MjA5MzU0NDQzMX0.QwwKC43x-ni-NKB8fjkWTWTCWjW3GkEDMws0R9qqeRI";
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
let currentUser = null;

// --- State Management (Cloud Save Architecture) ---
// 1. Game State (Saved to Supabase Cloud)
const DEFAULT_STATE = {
  level: 1,
  exp: 0,
  stamina: 3,
  medals: 0, // ガチャ用メダル
  inventory: {
    skill_picture: 0, // 絵師の魔道書
    skill_agitation: 0, // 煽りの書
    skill_shadow: 0, // 影の囁き
    skill_scale: 0, // 比較の天秤
    skill_amulet: 0, // 炎上回避の護符
  },
  questHistory: [], // 勝ちパターン分析用ログ
  subscriptionTier: "free", // 'free' or 'vip'
  completedQuests: 0,
  lastQuestDate: null,
  dailyQuestClaimed: false,
};

let userState = { ...DEFAULT_STATE };

// 2. Local Settings (Saved ONLY to browser localStorage for security)
const DEFAULT_LOCAL_SETTINGS = {
  aiProvider: "openai",
  apiKey: "",
};

let localSettings = { ...DEFAULT_LOCAL_SETTINGS };

// Supabase Database API (Using Auth User Metadata for MVP Cloud Saves)
const CloudDB = {
  async getUser() {
    if (!currentUser) return { ...DEFAULT_STATE };
    const metadata = currentUser.user_metadata;
    if (metadata && metadata.gameState) {
      return { ...DEFAULT_STATE, ...metadata.gameState };
    }
    // Fallback or new user
    return { ...DEFAULT_STATE };
  },
  async saveUser(state) {
    if (!currentUser) return;
    // Supabase user metadata update merges the object
    const { data, error } = await supabaseClient.auth.updateUser({
      data: { gameState: state },
    });
    if (error) {
      console.error("Cloud Save Failed:", error);
      showAlert("セーブエラー", "クラウドへのデータ保存に失敗しました。");
    }
  },
  async logQuestResult(record) {
    userState.questHistory.push(record);
    await this.saveUser(userState);
  },
};

const EXP_TABLE = {
  1: 100,
  2: 250,
  3: 500,
  4: 1000,
  5: 2000,
  6: 4000,
  7: 8000,
  8: 15000,
  9: 30000,
  10: 999999, // Max level for MVP
};

const TITLES = {
  1: "見習い錬金術師",
  3: "新米クリエイター",
  5: "熟練アフィリエイター",
  8: "導かれし発信者",
  10: "コンテンツ王",
};

const DAILY_QUESTS = [
  {
    title: "トレンドレビュー",
    desc: "今話題になっているガジェットやサービスについて、メリット・デメリットをまとめた記事を書こう。",
    keywordHint: "最新の〇〇",
  },
  {
    title: "お悩み解決",
    desc: "特定のターゲット（例：副業初心者）が抱える悩みを解決するノウハウをX(Twitter)でシェアしよう。",
    keywordHint: "〇〇の始め方",
  },
  {
    title: "比較検証",
    desc: "2つの似たような商品・サービスを比較し、どちらがどんな人に向いているか解説しよう。",
    keywordHint: "A vs B 徹底比較",
  },
  {
    title: "ツール紹介",
    desc: "あなたが最近使って便利だったツール（AIツールなど）の紹介記事を作成しよう。",
    keywordHint: "おすすめツール",
  },
];

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  // Check initial auth session with a timeout fallback
  try {
    const sessionPromise = supabaseClient.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), 3000),
    );

    const {
      data: { session },
    } = await Promise.race([sessionPromise, timeoutPromise]);

    if (session) {
      await handleLoginSuccess(session.user);
    } else {
      // Show login form, hide loading
      document.getElementById("auth-loading").style.display = "none";
      document.getElementById("auth-form").style.display = "block";
      document.getElementById("auth-screen").style.display = "flex";
      document.getElementById("main-app").style.display = "none";
    }
  } catch (error) {
    console.error("Auth init error:", error);
    // Fallback: if network fails, force show login form so user isn't stuck on loading screen
    document.getElementById("auth-loading").style.display = "none";
    document.getElementById("auth-form").style.display = "block";
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("main-app").style.display = "none";
  }

  // Listen for auth changes (logout from other tabs, etc.)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      document.getElementById("auth-loading").style.display = "none";
      document.getElementById("auth-form").style.display = "block";
      document.getElementById("auth-screen").style.display = "flex";
      document.getElementById("main-app").style.display = "none";
    }
  });

  setupNavigation();
  setupDailyQuest();
  setupEventListeners();
});

async function handleLoginSuccess(user) {
  currentUser = user;
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("main-app").style.display = "flex";
  document.getElementById("current-user-email").textContent = user.email;

  // Load state from cloud
  await loadState();
  updateUI();
}

async function loadState() {
  // 1. Load cloud game state
  userState = await CloudDB.getUser();

  // 2. Load local secure settings
  const savedSettings = localStorage.getItem("aiQuestLocalSettings");
  if (savedSettings) {
    localSettings = { ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(savedSettings) };
  }

  // Check daily reset (stamina and quest)
  const today = new Date().toDateString();
  if (userState.lastQuestDate !== today) {
    userState.stamina = 3;
    userState.lastQuestDate = today;
    userState.dailyQuestClaimed = false; // Reset daily quest reward
    await saveState(); // This syncs back to cloud
  }
}

async function saveState() {
  // Save state to cloud
  await CloudDB.saveUser(userState);
  // Save keys securely to local browser ONLY
  localStorage.setItem("aiQuestLocalSettings", JSON.stringify(localSettings));
}

// --- UI Updates ---
function updateUI() {
  // Stats
  document.getElementById("user-level").textContent = userState.level;
  document.getElementById("current-exp").textContent = userState.exp;
  const nextExp = EXP_TABLE[userState.level] || "MAX";
  document.getElementById("next-level-exp").textContent = nextExp;
  document.getElementById("stamina-count").textContent = userState.stamina;
  document.getElementById("medal-count").textContent = userState.medals;
  document.getElementById("gacha-medal-count").textContent = userState.medals;

  // Inventory Updates
  document.getElementById("inv-picture").textContent =
    userState.inventory.skill_picture || 0;
  document.getElementById("inv-agitation").textContent =
    userState.inventory.skill_agitation || 0;
  document.getElementById("inv-scale").textContent =
    userState.inventory.skill_scale || 0;
  document.getElementById("inv-amulet").textContent =
    userState.inventory.skill_amulet || 0;

  // Update Forge Skill Dropdown
  const skillSelect = document.getElementById("active-skill");
  // Save current selection to restore if possible
  const currentVal = skillSelect.value;
  skillSelect.innerHTML = '<option value="none">使用しない (通常錬成)</option>';

  if (userState.inventory.skill_picture > 0)
    skillSelect.innerHTML += `<option value="skill_picture">絵師の魔道書 (所持: ${userState.inventory.skill_picture})</option>`;
  if (userState.inventory.skill_agitation > 0)
    skillSelect.innerHTML += `<option value="skill_agitation">煽りの書 (所持: ${userState.inventory.skill_agitation})</option>`;
  if (userState.inventory.skill_scale > 0)
    skillSelect.innerHTML += `<option value="skill_scale">比較の天秤 (所持: ${userState.inventory.skill_scale})</option>`;
  if (userState.inventory.skill_amulet > 0)
    skillSelect.innerHTML += `<option value="skill_amulet">炎上回避の護符 (所持: ${userState.inventory.skill_amulet})</option>`;

  if (Array.from(skillSelect.options).some((opt) => opt.value === currentVal)) {
    skillSelect.value = currentVal;
  }

  // Title
  let currentTitle = TITLES[1];
  for (let lvl in TITLES) {
    if (userState.level >= parseInt(lvl)) currentTitle = TITLES[lvl];
  }
  document.getElementById("user-title").textContent = currentTitle;

  // History Count
  const historyCountEl = document.getElementById("history-count");
  if (historyCountEl) {
    historyCountEl.textContent = userState.questHistory.length;
  }

  // Strategy Recommender Update
  generateStrategyRecommendation();

  // Update Claim Daily Button
  const claimBtn = document.getElementById("btn-claim-daily");
  if (claimBtn) {
    if (userState.dailyQuestClaimed) {
      claimBtn.disabled = true;
      claimBtn.innerHTML = '<i class="fa-solid fa-check"></i> 報酬獲得済み';
      claimBtn.classList.add("btn-secondary");
      claimBtn.classList.remove("btn-success");
    } else {
      claimBtn.disabled = false;
      claimBtn.innerHTML =
        '<i class="fa-solid fa-gift"></i> クエスト完了報酬 (5メダル) を受け取る';
      claimBtn.classList.add("btn-success");
      claimBtn.classList.remove("btn-secondary");
    }
  }

  // Progress bar
  if (nextExp !== "MAX") {
    const prevExp = userState.level === 1 ? 0 : EXP_TABLE[userState.level - 1];
    const levelExpRange = nextExp - prevExp;
    const currentLevelExp = userState.exp - prevExp;
    const percent = Math.min(
      100,
      Math.max(0, (currentLevelExp / levelExpRange) * 100),
    );
    document.getElementById("exp-bar").style.width = `${percent}%`;
  } else {
    document.getElementById("exp-bar").style.width = "100%";
  }

  // Settings logic (Local secure storage)
  document.getElementById("ai-provider").value =
    localSettings.aiProvider || "openai";
  if (localSettings.apiKey) {
    document.getElementById("api-key-input").value = "********";
  } else {
    document.getElementById("api-key-input").value = "";
  }
}

// --- Navigation ---
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item:not(.premium-lock)");
  const sections = document.querySelectorAll(".content-section");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      // Remove active classes
      navItems.forEach((nav) => nav.classList.remove("active"));
      sections.forEach((sec) => sec.classList.remove("active"));

      // Add active class
      item.classList.add("active");
      const targetId = item.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
    });
  });

  // Alert Modal Logic
  const alertModal = document.getElementById("alert-modal");
  const closeAlertBtns = alertModal.querySelectorAll(
    ".close-btn, #btn-close-alert",
  );

  closeAlertBtns.forEach((btn) =>
    btn.addEventListener("click", () => (alertModal.style.display = "none")),
  );
  window.addEventListener("click", (e) => {
    if (e.target === alertModal) alertModal.style.display = "none";
  });
}

function showAlert(title, message) {
  document.getElementById("alert-title").textContent = title;
  document.getElementById("alert-message").textContent = message;
  document.getElementById("alert-modal").style.display = "block";
}

// --- Strategy Recommender Logic ---
function generateStrategyRecommendation() {
  const guideEl = document.getElementById("next-action-text");
  if (!guideEl) return;

  // Pseudo-random daily recommendation
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) /
      1000 /
      60 /
      60 /
      24,
  );

  const targets = [
    "20代女性",
    "忙しい社会人",
    "副業初心者",
    "ネットに強い層",
    "シニア層",
  ];
  const platforms = [
    "Instagramのカルーセル投稿",
    "X(Twitter)のツリー投稿",
    "TikTokのショート動画",
    "noteの長文記事",
  ];
  const categories = [
    "美容・健康",
    "ガジェット・PC",
    "金融・投資",
    "キャリア・転職",
    "最新のAIツール",
  ];

  const t = targets[dayOfYear % targets.length];
  const p = platforms[(dayOfYear + 3) % platforms.length];
  const c = categories[(dayOfYear + 5) % categories.length];

  guideEl.innerHTML = `本日のオススメ戦略：<br><span class='text-accent font-bold'>【${t}】</span>に向けて、<span class='text-primary font-bold'>【${p}】</span>で<span class='text-gold font-bold'>「${c}」</span>のアプローチを試すと、高い反響が得られそうです！`;
}

// --- Quest Logic ---
function setupDailyQuest() {
  // Generate two pseudo-random quests based on today's date for A/B testing
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) /
      1000 /
      60 /
      60 /
      24,
  );

  const mainQuestIndex = dayOfYear % DAILY_QUESTS.length;
  const subQuestIndex = (dayOfYear + 2) % DAILY_QUESTS.length; // Different quest

  const mainQuest = DAILY_QUESTS[mainQuestIndex];
  const subQuest = DAILY_QUESTS[subQuestIndex];

  // Main Quest UI
  document.getElementById("daily-quest-title").textContent = mainQuest.title;
  document.getElementById("daily-quest-desc").textContent = mainQuest.desc;

  // Sub Quest UI
  document.getElementById("sub-quest-title").textContent =
    subQuest.title + " (別アングル)";

  // Event Listeners for starting quests
  document.getElementById("btn-start-quest").addEventListener("click", () => {
    document.getElementById("content-keyword").value =
      mainQuest.keywordHint + " (Aパターン)";
    document.querySelector('[data-target="alchemy-forge"]').click();
  });

  document
    .getElementById("btn-start-sub-quest")
    .addEventListener("click", () => {
      document.getElementById("content-keyword").value =
        subQuest.keywordHint + " (Bパターン)";
      document.querySelector('[data-target="alchemy-forge"]').click();
    });
}

// --- AI Generation (OpenAI Mock/Integration) ---
async function generateContent() {
  if (userState.stamina <= 0) {
    alert(
      "スタミナが足りません！明日回復するのを待つか、プレミアム機能をご検討ください。",
    );
    return;
  }

  const target = document.getElementById("target-audience").value;
  const tone = document.getElementById("content-tone").value;
  const keyword = document.getElementById("content-keyword").value;
  const category = document.getElementById("affiliate-category").value;
  const platform = document.getElementById("content-platform").value;
  const activeSkill = document.getElementById("active-skill").value;
  const resultBox = document.getElementById("generated-content");
  const btn = document.getElementById("btn-generate");

  if (!keyword) {
    alert("キーワード/テーマを入力してください。");
    return;
  }

  // Cost stamina
  userState.stamina -= 1;

  // Process skill usage
  let skillPromptModifier = "";
  if (activeSkill !== "none") {
    if (userState.inventory[activeSkill] > 0) {
      userState.inventory[activeSkill] -= 1;

      // Skill Effects
      if (activeSkill === "skill_picture") {
        skillPromptModifier =
          "\n\n【追加指示: 絵師の魔道書】\n記事の最後（またはアイキャッチ用）に、MidjourneyやDALL-Eで使える、この記事の内容にぴったりな画像を生成するための「英語のプロンプト」を1つ出力してください。";
      } else if (activeSkill === "skill_agitation") {
        skillPromptModifier =
          "\n\n【追加指示: 煽りの書】\n読者の購買意欲を強烈に刺激するため、PASONAの法則を用いて、悩みを深堀りし、緊急性を煽るようなコピーライティングを意識して作成してください。";
      } else if (activeSkill === "skill_scale") {
        skillPromptModifier =
          "\n\n【追加指示: 比較の天秤】\n対象となる商品やサービス（または一般的な代替品）について、メリット・デメリット・価格などが一目でわかる比較表をMarkdown形式で出力してください。";
      } else if (activeSkill === "skill_amulet") {
        skillPromptModifier =
          "\n\n【追加指示: 炎上回避の護符】\nプラットフォームの規約や薬機法、景品表示法に抵触しないよう、断定的な表現（絶対、必ず治る等）は避け、マイルドでクリーンな表現に徹底的に修正してください。";
      }
    } else {
      alert("そのスキルは所持していません。");
      userState.stamina += 1;
      return;
    }
  }

  saveState();
  updateUI();

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 錬成中...';
  btn.disabled = true;
  resultBox.value =
    "AIが思考中...\n(※APIキーが設定されていない場合はモック文章が表示されます)";

  const categoryText =
    category !== "指定なし"
      ? `\nアフィリエイト・カテゴリー: ${category} (このジャンルに特化した訴求を行うこと)`
      : "";
  const prompt = `あなたはプロのWebライター兼アフィリエイトマーケターです。以下の条件で${platform}用のコンテンツを作成してください。\n\nターゲット層: ${target}\nトーン＆マナー: ${tone}\nテーマ/キーワード: ${keyword}${categoryText}\n\n出力形式: そのままコピペして使える見出し付きの文章。${skillPromptModifier}`;

  try {
    let generatedText = "";

    if (localSettings.apiKey && localSettings.apiKey !== "********") {
      const provider = localSettings.aiProvider || "openai";

      if (provider === "openai") {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localSettings.apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [{ role: "user", content: prompt }],
            }),
          },
        );

        if (!response.ok)
          throw new Error(
            "OpenAI APIエラー。キーが正しいか、利用枠があるか確認してください。",
          );
        const data = await response.json();
        generatedText = data.choices[0].message.content;
      } else if (provider === "gemini") {
        // Gemini API integration
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${localSettings.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
            }),
          },
        );

        if (!response.ok)
          throw new Error("Gemini APIエラー。キーが正しいか確認してください。");
        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
          generatedText = data.candidates[0].content.parts[0].text;
        } else {
          throw new Error("Geminiからの応答形式が予期せぬものでした。");
        }
      }
    } else {
      // Mock Delay
      await new Promise((r) => setTimeout(r, 2000));
      generatedText = `【${keyword}】について（モック生成結果）\n\n対象: ${target} / トーン: ${tone}\n\n※ここにAIによって生成された魅力的な${platform}が生成されます。\n※実際にご利用になる場合は、「設定」タブからOpenAIのAPIキーを登録してください。\n\n見出し1：${keyword}のメリット\n見出し2：注意点\nまとめ：今すぐ行動しよう！`;
    }

    resultBox.value = generatedText;
  } catch (error) {
    resultBox.value = `エラーが発生しました:\n${error.message}`;
    // Refund stamina on error
    userState.stamina += 1;
    saveState();
    updateUI();
  } finally {
    btn.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> 錬成開始 (スタミナ -1)';
    btn.disabled = false;
  }
}

// --- Gacha System ---
const GACHA_POOL = [
  {
    id: "skill_picture",
    name: "絵師の魔道書",
    icon: '<i class="fa-solid fa-image text-accent"></i>',
  },
  {
    id: "skill_agitation",
    name: "煽りの書",
    icon: '<i class="fa-solid fa-fire text-danger"></i>',
  },
  {
    id: "skill_scale",
    name: "比較の天秤",
    icon: '<i class="fa-solid fa-scale-balanced text-success"></i>',
  },
  {
    id: "skill_amulet",
    name: "炎上回避の護符",
    icon: '<i class="fa-solid fa-shield-halved text-primary"></i>',
  },
];

async function rollGacha() {
  const cost = 10;
  const resultBox = document.getElementById("gacha-result");
  const btn = document.getElementById("btn-roll-gacha");

  if (userState.medals < cost) {
    resultBox.innerHTML =
      '<span class="text-danger">メダルが足りません！（1回10メダル）<br>クエストをこなして報告ギルドで稼ぎましょう。</span>';
    resultBox.style.display = "block";
    return;
  }

  // Deduct cost
  userState.medals -= cost;
  btn.disabled = true;
  btn.textContent = "ガチャ回転中...";
  resultBox.style.display = "none";

  // Add exciting animation class to the icon
  const gachaContainer = document.querySelector(".gacha-container .quest-card");
  gachaContainer.classList.add("gacha-animating");

  updateUI();

  // Mock animation delay
  await new Promise((r) => setTimeout(r, 1500));

  gachaContainer.classList.remove("gacha-animating");

  // Roll logic
  const randomIndex = Math.floor(Math.random() * GACHA_POOL.length);
  const wonItem = GACHA_POOL[randomIndex];

  // Add to inventory
  userState.inventory[wonItem.id] = (userState.inventory[wonItem.id] || 0) + 1;
  await saveState();
  updateUI();

  // Display result
  resultBox.innerHTML = `
        <h3 class="text-gold">✨ スキル獲得！ ✨</h3>
        <div style="font-size: 2rem; margin: 1rem 0;">${wonItem.icon}</div>
        <p style="color: var(--text-main);"><strong>${wonItem.name}</strong> を獲得しました！</p>
        <p class="text-small mt-2" style="color: var(--text-main);">コンテンツ錬成画面でセットして使用できます。</p>
    `;
  resultBox.style.display = "block";
  btn.disabled = false;
  btn.textContent = "もう一度回す";
}

// --- Magic Eye (Analytics) ---
async function activateMagicEye() {
  if (userState.questHistory.length < 3) {
    showAlert(
      "データ不足",
      `分析には最低3件の報告データが必要です。\n現在: ${userState.questHistory.length}件 / 必要: 3件\n\nまずはクエストをこなしてギルドに報告しましょう。`,
    );
    return;
  }

  if (!localSettings.apiKey || localSettings.apiKey === "********") {
    showAlert(
      "APIキー未設定",
      "魔眼によるAI分析を行うには、「設定」タブからOpenAIまたはGeminiのAPIキーを登録してください。",
    );
    return;
  }

  const btn = document.getElementById("btn-activate-magic-eye");
  const intro = document.getElementById("magic-eye-intro");
  const loading = document.getElementById("magic-eye-loading");
  const resultBox = document.getElementById("magic-eye-result");

  intro.style.display = "none";
  resultBox.style.display = "none";
  loading.style.display = "block";

  // 履歴データを直近10件までに絞って文字列化
  const recentHistory = userState.questHistory.slice(-10);
  const historyText = recentHistory
    .map(
      (h) =>
        `- キーワード: ${h.keyword}, インプレッション: ${h.impressions}, コンバージョン: ${h.conversions}`,
    )
    .join("\n");

  const prompt = `あなたはプロのWebマーケター兼データアナリストです。以下のユーザーのアフィリエイト投稿履歴（キーワード、閲覧数、コンバージョン数）を分析してください。

【履歴データ】
${historyText}

上記のデータから、どのキーワードやジャンルが最も反響（閲覧やCV）が良かったかを推測し、以下の3点を提示してください。
必ず指定されたJSONフォーマットのみを出力してください。Markdownブロック(\`\`\`json)は不要です。

【出力フォーマット】
{
  "analysis": "なぜそのキーワード/ジャンルがウケたのかのプロとしての考察（200文字程度）",
  "target": "次に狙うべき具体的なターゲット層（ペルソナ）",
  "custom_quest": "分析に基づいた、次に投稿すべき具体的な記事のテーマ・キーワード案"
}`;

  try {
    let aiResponseText = "";
    const provider = localSettings.aiProvider || "openai";

    if (provider === "openai") {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localSettings.apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) throw new Error("OpenAI APIエラー");
      const data = await response.json();
      aiResponseText = data.choices[0].message.content;
    } else if (provider === "gemini") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${localSettings.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!response.ok) throw new Error("Gemini APIエラー");
      const data = await response.json();
      aiResponseText = data.candidates[0].content.parts[0].text;
    }

    // Clean up markdown wrapper if AI ignored the instruction
    aiResponseText = aiResponseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsedResult = JSON.parse(aiResponseText);

    document.getElementById("result-analysis").textContent =
      parsedResult.analysis;
    document.getElementById("result-target").textContent = parsedResult.target;
    document.getElementById("result-quest").textContent =
      parsedResult.custom_quest;

    loading.style.display = "none";
    resultBox.style.display = "block";

    // Setup accept button
    document.getElementById("btn-accept-custom-quest").onclick = () => {
      document.getElementById("content-keyword").value =
        parsedResult.custom_quest;
      document.querySelector('[data-target="alchemy-forge"]').click();
    };
  } catch (error) {
    console.error("Magic Eye Error:", error);
    loading.style.display = "none";
    intro.style.display = "block";
    showAlert(
      "解析失敗",
      "魔眼の解析中にエラーが発生しました。APIキーや通信環境を確認してください。\n" +
        error.message,
    );
  }
}

// --- Auto Macro (Node Automation) ---
async function runAutoMacro() {
  if (userState.stamina < 2) {
    showAlert("スタミナ不足", "自動錬成陣の起動にはスタミナが2必要です。");
    return;
  }
  if (!localSettings.apiKey || localSettings.apiKey === "********") {
    showAlert("APIキー未設定", "自動錬成にはAPIキーの設定が必要です。");
    return;
  }

  const category = document.getElementById("macro-category").value;
  const btn = document.getElementById("btn-start-macro");
  const nodes = [
    document.getElementById("node-1"),
    document.getElementById("node-2"),
    document.getElementById("node-3"),
  ];
  const outputs = [
    nodes[0].querySelector(".node-output"),
    nodes[1].querySelector(".node-output"),
    nodes[2].querySelector(".node-output"),
  ];
  const copyBtn = document.getElementById("btn-copy-macro");

  // Reset UI
  nodes.forEach((n) => {
    n.style.opacity = "0.5";
    n.style.boxShadow = "none";
  });
  outputs.forEach((o) => {
    o.style.display = "none";
    o.innerHTML = "";
    o.value = "";
  });
  copyBtn.style.display = "none";

  userState.stamina -= 2;
  await saveState();
  updateUI();

  btn.disabled = true;
  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> 錬成陣 稼働中...';

  // Helper fetch function
  async function fetchAI(aiPrompt) {
    const provider = localSettings.aiProvider || "openai";
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: aiPrompt }],
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      return data.choices[0].message.content;
    } else {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${localSettings.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] }),
        },
      );
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    }
  }

  try {
    // --- NODE 1: Brainstorm ---
    nodes[0].style.opacity = "1";
    nodes[0].style.boxShadow = "0 0 15px var(--primary)";
    outputs[0].style.display = "block";
    outputs[0].textContent = "AIがトレンドを思考中...";

    let keyword = await fetchAI(
      `アフィリエイトの「${category}」ジャンルで、現在SNSでバズりやすい、あるいは検索されやすいニッチなキーワードを1つだけ提案してください。理由や説明は不要です。キーワードのみを出力してください。`,
    );
    keyword = keyword.trim();
    outputs[0].innerHTML = `<span class="text-gold font-bold">抽出キーワード:</span> ${keyword}`;
    nodes[0].style.boxShadow = "none";

    // --- NODE 2: Research ---
    nodes[1].style.opacity = "1";
    nodes[1].style.boxShadow = "0 0 15px var(--accent)";
    outputs[1].style.display = "block";
    outputs[1].textContent = "キーワードを深掘りリサーチ中...";

    let research = await fetchAI(
      `キーワード「${keyword}」について、読者が抱えている深い悩み、このキーワードに関連する商品のメリット・デメリットを箇条書きで簡潔にまとめてください。`,
    );
    outputs[1].innerHTML = `<span class="text-gold font-bold">リサーチ完了:</span><br>${research.replace(/\n/g, "<br>")}`;
    nodes[1].style.boxShadow = "none";

    // --- NODE 3: Generation ---
    nodes[2].style.opacity = "1";
    nodes[2].style.boxShadow = "0 0 15px var(--gold)";
    outputs[2].style.display = "block";
    outputs[2].value = "最終記事を錬成中...";

    let article = await fetchAI(
      `以下のリサーチ結果を元に、読者の購買意欲を高めるアフィリエイト用ブログ記事（見出し付き）を作成してください。\n\n【テーマ】${keyword}\n【リサーチ結果】\n${research}`,
    );
    outputs[2].value = article;
    nodes[2].style.boxShadow = "0 0 20px var(--success)";
    copyBtn.style.display = "block";
  } catch (error) {
    console.error(error);
    showAlert("マクロ実行エラー", "自動錬成中にエラーが発生しました。");
    userState.stamina += 2; // Refund
    await saveState();
    updateUI();
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="fa-solid fa-play"></i> 錬成陣を起動する (スタミナ -2)';
  }
}

// --- Gamification (EXP & Leveling) ---
async function submitReport() {
  const keyword =
    document.getElementById("input-keyword").value || "不明なクエスト";
  const imp = parseInt(document.getElementById("input-impressions").value) || 0;
  const conv =
    parseInt(document.getElementById("input-conversions").value) || 0;
  const msgBox = document.getElementById("report-result-message");

  if (imp === 0 && conv === 0) {
    msgBox.textContent = "数値を入力してください。";
    msgBox.className = "mt-2 text-danger";
    msgBox.style.display = "block";
    return;
  }

  // Formula: 100 imp = 10 EXP, 1 conv = 50 EXP
  const expGained = Math.floor(imp / 10) + conv * 50;

  if (expGained <= 0) {
    msgBox.textContent =
      "成果を獲得できませんでした。もう少しインプレッションが必要です。";
    msgBox.className = "mt-3 text-muted text-center";
    msgBox.style.display = "block";
    return;
  }

  userState.exp += expGained;

  // Log to Cloud DB history
  await CloudDB.logQuestResult({
    date: new Date().toISOString(),
    keyword: keyword,
    impressions: imp,
    conversions: conv,
    expGained: expGained,
  });

  // Check level up & reward medals (50 per level)
  let levelUpMsg = "";
  let levelUpMedals = 0;
  while (
    EXP_TABLE[userState.level] &&
    userState.exp >= EXP_TABLE[userState.level]
  ) {
    userState.level++;
    levelUpMedals += 50;
    levelUpMsg = `<br><span class="text-accent text-glow">🎉 レベルアップ！ レベル ${userState.level} になりました！</span><br><strong class="text-gold">🎁 レベルアップ報酬: 50 メダル獲得！</strong>`;
  }

  if (levelUpMedals > 0) {
    userState.medals += levelUpMedals;
  }

  await saveState();
  updateUI();

  document.getElementById("input-keyword").value = "";
  document.getElementById("input-impressions").value = "";
  document.getElementById("input-conversions").value = "";

  msgBox.innerHTML = `<strong>${expGained} EXP</strong> を獲得しました！${levelUpMsg}`;
  msgBox.className = "mt-3 text-success text-center";
  msgBox.style.display = "block";

  setTimeout(() => {
    msgBox.style.display = "none";
  }, 8000);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  document
    .getElementById("btn-generate")
    .addEventListener("click", generateContent);

  document.getElementById("btn-copy").addEventListener("click", () => {
    const text = document.getElementById("generated-content").value;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("btn-copy");
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> コピー完了!';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2000);
      });
    }
  });

  document
    .getElementById("btn-submit-report")
    .addEventListener("click", submitReport);
  document
    .getElementById("btn-roll-gacha")
    .addEventListener("click", rollGacha);
  document
    .getElementById("btn-activate-magic-eye")
    .addEventListener("click", activateMagicEye);

  const btnStartMacro = document.getElementById("btn-start-macro");
  if (btnStartMacro) btnStartMacro.addEventListener("click", runAutoMacro);

  const btnCopyMacro = document.getElementById("btn-copy-macro");
  if (btnCopyMacro) {
    btnCopyMacro.addEventListener("click", () => {
      const text = document.querySelector("#node-3 .node-output").value;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          const originalHTML = btnCopyMacro.innerHTML;
          btnCopyMacro.innerHTML =
            '<i class="fa-solid fa-check"></i> コピー完了!';
          setTimeout(() => {
            btnCopyMacro.innerHTML = originalHTML;
          }, 2000);
        });
      }
    });
  }

  // Auth Buttons
  const emailInput = document.getElementById("auth-email");
  const passInput = document.getElementById("auth-password");
  const authError = document.getElementById("auth-error-msg");

  const handleAuth = async (type) => {
    authError.style.display = "none";
    const email = emailInput.value;
    const password = passInput.value;

    if (!email || !password) {
      authError.textContent = "メールアドレスとパスワードを入力してください。";
      authError.style.display = "block";
      return;
    }

    const btn =
      type === "login"
        ? document.getElementById("btn-login")
        : document.getElementById("btn-signup");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 通信中...';
    btn.disabled = true;

    try {
      let error;
      if (type === "login") {
        const res = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
        error = res.error;
        if (!error && res.data.user) {
          await handleLoginSuccess(res.data.user);
        }
      } else {
        const res = await supabaseClient.auth.signUp({ email, password });
        error = res.error;
        if (!error && res.data.user) {
          if (
            res.data.user.identities &&
            res.data.user.identities.length === 0
          ) {
            throw new Error("このメールアドレスは既に登録されています。");
          }
          await handleLoginSuccess(res.data.user);
        }
      }

      if (error) throw error;
    } catch (err) {
      authError.textContent = err.message || "エラーが発生しました。";
      authError.style.display = "block";
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  document
    .getElementById("btn-login")
    .addEventListener("click", () => handleAuth("login"));
  document
    .getElementById("btn-signup")
    .addEventListener("click", () => handleAuth("signup"));

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });

  const claimBtn = document.getElementById("btn-claim-daily");
  if (claimBtn) {
    claimBtn.addEventListener("click", async () => {
      if (!userState.dailyQuestClaimed) {
        userState.medals += 5;
        userState.dailyQuestClaimed = true;
        await saveState();
        updateUI();
        alert(
          "デイリークエスト報酬の 5 メダルを獲得しました！ガチャを引きに行きましょう！",
        );
      }
    });
  }

  // Handle changing provider
  document.getElementById("ai-provider").addEventListener("change", (e) => {
    localSettings.aiProvider = e.target.value;
  });

  document
    .getElementById("btn-save-key")
    .addEventListener("click", async () => {
      const key = document.getElementById("api-key-input").value;
      const provider = document.getElementById("ai-provider").value;
      const msg = document.getElementById("settings-message");

      localSettings.aiProvider = provider;

      if (key && key !== "********") {
        localSettings.apiKey = key;
      }

      await saveState(); // This syncs to local storage securely
      msg.textContent = "魔力源（APIキー）を安全に保存しました。";
      msg.style.display = "block";
      updateUI();
      setTimeout(() => {
        msg.style.display = "none";
      }, 3000);
    });

  const resetBtn = document.getElementById("btn-reset-data");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (
        confirm(
          "本当にデータをリセットしますか？レベルやEXP、インベントリがすべて失われます。",
        )
      ) {
        userState = { ...DEFAULT_STATE };
        await saveState();
        updateUI();
        alert("ゲームデータを初期化しました。");
      }
    });
  }
}
