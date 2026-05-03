// ==========================================
// AI Quest - Game Logic & Core Functions
// ==========================================

// --- State Management ---
const DEFAULT_STATE = {
    level: 1,
    exp: 0,
    stamina: 3,
    apiKey: '',
    completedQuests: 0,
    lastQuestDate: null
};

let userState = { ...DEFAULT_STATE };

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
    10: 999999 // Max level for MVP
};

const TITLES = {
    1: "見習い錬金術師",
    3: "新米クリエイター",
    5: "熟練のアフィリエイター",
    8: "導かれし発信者",
    10: "コンテンツ王"
};

const DAILY_QUESTS = [
    { title: "トレンドレビュー", desc: "今話題になっているガジェットやサービスについて、メリット・デメリットをまとめた記事を書こう。", keywordHint: "最新の〇〇" },
    { title: "お悩み解決", desc: "特定のターゲット（例：副業初心者）が抱える悩みを解決するノウハウをX(Twitter)でシェアしよう。", keywordHint: "〇〇の始め方" },
    { title: "比較検証", desc: "2つの似たような商品・サービスを比較し、どちらがどんな人に向いているか解説しよう。", keywordHint: "A vs B 徹底比較" },
    { title: "ツール紹介", desc: "あなたが最近使って便利だったツール（AIツールなど）の紹介記事を作成しよう。", keywordHint: "おすすめツール" }
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupNavigation();
    setupDailyQuest();
    updateUI();
    setupEventListeners();
});

function loadState() {
    const saved = localStorage.getItem('aiQuestState');
    if (saved) {
        userState = { ...DEFAULT_STATE, ...JSON.parse(saved) };
    }

    // Check daily reset (stamina and quest)
    const today = new Date().toDateString();
    if (userState.lastQuestDate !== today) {
        userState.stamina = 3;
        userState.lastQuestDate = today;
        saveState();
    }
}

function saveState() {
    localStorage.setItem('aiQuestState', JSON.stringify(userState));
}

// --- UI Updates ---
function updateUI() {
    // Stats
    document.getElementById('user-level').textContent = userState.level;
    document.getElementById('current-exp').textContent = userState.exp;
    const nextExp = EXP_TABLE[userState.level] || "MAX";
    document.getElementById('next-level-exp').textContent = nextExp;
    document.getElementById('stamina-count').textContent = userState.stamina;

    // Title
    let currentTitle = TITLES[1];
    for (let lvl in TITLES) {
        if (userState.level >= parseInt(lvl)) currentTitle = TITLES[lvl];
    }
    document.getElementById('user-title').textContent = currentTitle;

    // Progress bar
    if (nextExp !== "MAX") {
        const prevExp = userState.level === 1 ? 0 : EXP_TABLE[userState.level - 1];
        const levelExpRange = nextExp - prevExp;
        const currentLevelExp = userState.exp - prevExp;
        const percent = Math.min(100, Math.max(0, (currentLevelExp / levelExpRange) * 100));
        document.getElementById('exp-bar').style.width = `${percent}%`;
    } else {
        document.getElementById('exp-bar').style.width = '100%';
    }

    // Settings API Key mask
    if (userState.apiKey) {
        document.getElementById('api-key-input').value = "********";
    }
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item:not(.premium-lock)');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active classes
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            // Add active class
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Premium locks
    const premiumItems = document.querySelectorAll('.premium-lock');
    const modal = document.getElementById('premium-modal');
    const closeBtn = document.querySelector('.close-btn');

    premiumItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'block';
        });
    });

    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

// --- Quest Logic ---
function setupDailyQuest() {
    // Generate a random quest based on today's date so it's consistent for the day
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const questIndex = dayOfYear % DAILY_QUESTS.length;
    const quest = DAILY_QUESTS[questIndex];

    document.getElementById('daily-quest-title').textContent = quest.title;
    document.getElementById('daily-quest-desc').textContent = quest.desc;

    // Auto-fill keyword hint when starting quest
    document.getElementById('btn-start-quest').addEventListener('click', () => {
        document.getElementById('content-keyword').value = quest.keywordHint;
        // Switch tab to forge
        document.querySelector('[data-target="alchemy-forge"]').click();
    });
}

// --- AI Generation (OpenAI Mock/Integration) ---
async function generateContent() {
    if (userState.stamina <= 0) {
        alert("スタミナが足りません！明日回復するのを待つか、プレミアム機能をご検討ください。");
        return;
    }

    const target = document.getElementById('target-audience').value;
    const tone = document.getElementById('content-tone').value;
    const keyword = document.getElementById('content-keyword').value;
    const platform = document.getElementById('content-platform').value;
    const resultBox = document.getElementById('generated-content');
    const btn = document.getElementById('btn-generate');

    if (!keyword) {
        alert("キーワード/テーマを入力してください。");
        return;
    }

    // Cost stamina
    userState.stamina -= 1;
    saveState();
    updateUI();

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 錬成中...';
    btn.disabled = true;
    resultBox.value = "AIが思考中...\n(※APIキーが設定されていない場合はモック文章が表示されます)";

    const prompt = `あなたはプロのWebライター兼マーケターです。以下の条件で${platform}用のコンテンツを作成してください。\n\nターゲット層: ${target}\nトーン＆マナー: ${tone}\nテーマ/キーワード: ${keyword}\n\n出力形式: そのままコピペして使える見出し付きの文章。`;

    try {
        let generatedText = "";

        if (userState.apiKey && userState.apiKey !== "********") {
            // Real API Call (Be careful with exposing keys in purely client-side apps, this is for MVP/demo purposes)
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userState.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!response.ok) throw new Error("APIリクエストエラー。キーが正しいか確認してください。");
            const data = await response.json();
            generatedText = data.choices[0].message.content;
        } else {
            // Mock Delay
            await new Promise(r => setTimeout(r, 2000));
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
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 錬成開始 (スタミナ -1)';
        btn.disabled = false;
    }
}

// --- Gamification (EXP & Leveling) ---
function submitReport() {
    const imp = parseInt(document.getElementById('input-impressions').value) || 0;
    const conv = parseInt(document.getElementById('input-conversions').value) || 0;
    const msgBox = document.getElementById('report-result-message');

    if (imp === 0 && conv === 0) {
        msgBox.textContent = "数値を入力してください。";
        msgBox.className = "mt-2 text-danger";
        msgBox.style.display = "block";
        return;
    }

    // Formula: 100 imp = 10 EXP, 1 conv = 50 EXP
    const expGained = Math.floor(imp / 10) + (conv * 50);

    if (expGained <= 0) {
        msgBox.textContent = "経験値を獲得できませんでした。もう少しインプレッションが必要です。";
        msgBox.className = "mt-2 text-muted";
        msgBox.style.display = "block";
        return;
    }

    userState.exp += expGained;

    // Check level up
    let levelUpMsg = "";
    while (EXP_TABLE[userState.level] && userState.exp >= EXP_TABLE[userState.level]) {
        userState.level++;
        levelUpMsg = `\n🎉 レベルアップ！ レベル ${userState.level} になりました！`;
    }

    saveState();
    updateUI();

    document.getElementById('input-impressions').value = '';
    document.getElementById('input-conversions').value = '';

    msgBox.innerHTML = `<strong>${expGained} EXP</strong> を獲得しました！${levelUpMsg}`;
    msgBox.className = "mt-2 text-success";
    msgBox.style.display = "block";

    setTimeout(() => { msgBox.style.display = "none"; }, 5000);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    document.getElementById('btn-generate').addEventListener('click', generateContent);

    document.getElementById('btn-copy').addEventListener('click', () => {
        const text = document.getElementById('generated-content').value;
        if(text) {
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('btn-copy');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> コピー完了!';
                setTimeout(() => { btn.innerHTML = originalText; }, 2000);
            });
        }
    });

    document.getElementById('btn-submit-report').addEventListener('click', submitReport);

    document.getElementById('btn-save-key').addEventListener('click', () => {
        const key = document.getElementById('api-key-input').value;
        const msg = document.getElementById('settings-message');
        if (key && key !== "********") {
            userState.apiKey = key;
            saveState();
            msg.textContent = "APIキーを保存しました。";
            msg.style.display = "block";
            updateUI();
            setTimeout(() => { msg.style.display = "none"; }, 3000);
        }
    });

    document.getElementById('btn-reset-data').addEventListener('click', () => {
        if(confirm("本当にデータをリセットしますか？レベルやEXPがすべて失われます。")) {
            userState = { ...DEFAULT_STATE };
            saveState();
            updateUI();
            alert("データを初期化しました。");
        }
    });
}