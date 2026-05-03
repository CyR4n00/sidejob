// ==========================================
// AI Quest - Game Logic & Core Functions
// ==========================================

// --- State Management (Mock DB Architecture) ---
const DEFAULT_STATE = {
    level: 1,
    exp: 0,
    stamina: 3,
    medals: 0, // ガチャ用メダル
    inventory: {
        skill_picture: 0,  // 絵師の魔道書
        skill_agitation: 0, // 煽りの書
        skill_shadow: 0,    // 影の囁き
        skill_scale: 0,     // 比較の天秤
        skill_amulet: 0     // 炎上回避の護符
    },
    questHistory: [], // 勝ちパターン分析用ログ
    subscriptionTier: 'free', // 'free' or 'vip'
    aiProvider: 'openai',
    apiKey: '',
    completedQuests: 0,
    lastQuestDate: null
};

let userState = { ...DEFAULT_STATE };

// Mock Database API (Future-proofing for Supabase integration)
const MockDB = {
    async getUser() {
        const saved = localStorage.getItem('aiQuestState');
        return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
    },
    async saveUser(state) {
        localStorage.setItem('aiQuestState', JSON.stringify(state));
    },
    async logQuestResult(record) {
        // record: { date, keyword, impressions, conversions, expGained }
        userState.questHistory.push(record);
        await this.saveUser(userState);
    }
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
document.addEventListener('DOMContentLoaded', async () => {
    await loadState();
    setupNavigation();
    setupDailyQuest();
    updateUI();
    setupEventListeners();
});

async function loadState() {
    userState = await MockDB.getUser();

    // Check daily reset (stamina and quest)
    const today = new Date().toDateString();
    if (userState.lastQuestDate !== today) {
        userState.stamina = 3;
        userState.lastQuestDate = today;
        await saveState();
    }
}

async function saveState() {
    await MockDB.saveUser(userState);
}

// --- UI Updates ---
function updateUI() {
    // Stats
    document.getElementById('user-level').textContent = userState.level;
    document.getElementById('current-exp').textContent = userState.exp;
    const nextExp = EXP_TABLE[userState.level] || "MAX";
    document.getElementById('next-level-exp').textContent = nextExp;
    document.getElementById('stamina-count').textContent = userState.stamina;
    document.getElementById('medal-count').textContent = userState.medals;
    document.getElementById('gacha-medal-count').textContent = userState.medals;

    // Inventory Updates
    document.getElementById('inv-picture').textContent = userState.inventory.skill_picture || 0;
    document.getElementById('inv-agitation').textContent = userState.inventory.skill_agitation || 0;
    document.getElementById('inv-scale').textContent = userState.inventory.skill_scale || 0;
    document.getElementById('inv-amulet').textContent = userState.inventory.skill_amulet || 0;

    // Update Forge Skill Dropdown
    const skillSelect = document.getElementById('active-skill');
    // Save current selection to restore if possible
    const currentVal = skillSelect.value;
    skillSelect.innerHTML = '<option value="none">使用しない (通常錬成)</option>';

    if(userState.inventory.skill_picture > 0) skillSelect.innerHTML += `<option value="skill_picture">絵師の魔道書 (所持: ${userState.inventory.skill_picture})</option>`;
    if(userState.inventory.skill_agitation > 0) skillSelect.innerHTML += `<option value="skill_agitation">煽りの書 (所持: ${userState.inventory.skill_agitation})</option>`;
    if(userState.inventory.skill_scale > 0) skillSelect.innerHTML += `<option value="skill_scale">比較の天秤 (所持: ${userState.inventory.skill_scale})</option>`;
    if(userState.inventory.skill_amulet > 0) skillSelect.innerHTML += `<option value="skill_amulet">炎上回避の護符 (所持: ${userState.inventory.skill_amulet})</option>`;

    if(Array.from(skillSelect.options).some(opt => opt.value === currentVal)) {
        skillSelect.value = currentVal;
    }

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

    // Settings logic
    document.getElementById('ai-provider').value = userState.aiProvider || 'openai';
    if (userState.apiKey) {
        document.getElementById('api-key-input').value = "********";
    } else {
        document.getElementById('api-key-input').value = "";
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
    const closeBtns = document.querySelectorAll('.close-btn, #btn-close-premium');

    premiumItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'block';
        });
    });

    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.style.display = 'none'));
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
    const category = document.getElementById('affiliate-category').value;
    const platform = document.getElementById('content-platform').value;
    const activeSkill = document.getElementById('active-skill').value;
    const resultBox = document.getElementById('generated-content');
    const btn = document.getElementById('btn-generate');

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
                skillPromptModifier = "\n\n【追加指示: 絵師の魔道書】\n記事の最後（またはアイキャッチ用）に、MidjourneyやDALL-Eで使える、この記事の内容にぴったりな画像を生成するための「英語のプロンプト」を1つ出力してください。";
            } else if (activeSkill === "skill_agitation") {
                skillPromptModifier = "\n\n【追加指示: 煽りの書】\n読者の購買意欲を強烈に刺激するため、PASONAの法則を用いて、悩みを深堀りし、緊急性を煽るようなコピーライティングを意識して作成してください。";
            } else if (activeSkill === "skill_scale") {
                skillPromptModifier = "\n\n【追加指示: 比較の天秤】\n対象となる商品やサービス（または一般的な代替品）について、メリット・デメリット・価格などが一目でわかる比較表をMarkdown形式で出力してください。";
            } else if (activeSkill === "skill_amulet") {
                skillPromptModifier = "\n\n【追加指示: 炎上回避の護符】\nプラットフォームの規約や薬機法、景品表示法に抵触しないよう、断定的な表現（絶対、必ず治る等）は避け、マイルドでクリーンな表現に徹底的に修正してください。";
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
    resultBox.value = "AIが思考中...\n(※APIキーが設定されていない場合はモック文章が表示されます)";

    const categoryText = category !== "指定なし" ? `\nアフィリエイト・カテゴリー: ${category} (このジャンルに特化した訴求を行うこと)` : "";
    const prompt = `あなたはプロのWebライター兼アフィリエイトマーケターです。以下の条件で${platform}用のコンテンツを作成してください。\n\nターゲット層: ${target}\nトーン＆マナー: ${tone}\nテーマ/キーワード: ${keyword}${categoryText}\n\n出力形式: そのままコピペして使える見出し付きの文章。${skillPromptModifier}`;

    try {
        let generatedText = "";

        if (userState.apiKey && userState.apiKey !== "********") {
            const provider = userState.aiProvider || 'openai';

            if (provider === 'openai') {
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

                if (!response.ok) throw new Error("OpenAI APIエラー。キーが正しいか、利用枠があるか確認してください。");
                const data = await response.json();
                generatedText = data.choices[0].message.content;

            } else if (provider === 'gemini') {
                // Gemini API integration
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${userState.apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    })
                });

                if (!response.ok) throw new Error("Gemini APIエラー。キーが正しいか確認してください。");
                const data = await response.json();
                if(data.candidates && data.candidates[0].content.parts[0].text) {
                    generatedText = data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error("Geminiからの応答形式が予期せぬものでした。");
                }
            }
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

// --- Gacha System ---
const GACHA_POOL = [
    { id: 'skill_picture', name: '絵師の魔道書', icon: '<i class="fa-solid fa-image text-accent"></i>' },
    { id: 'skill_agitation', name: '煽りの書', icon: '<i class="fa-solid fa-fire text-danger"></i>' },
    { id: 'skill_scale', name: '比較の天秤', icon: '<i class="fa-solid fa-scale-balanced text-success"></i>' },
    { id: 'skill_amulet', name: '炎上回避の護符', icon: '<i class="fa-solid fa-shield-halved text-primary"></i>' }
];

async function rollGacha() {
    const cost = 10;
    const resultBox = document.getElementById('gacha-result');
    const btn = document.getElementById('btn-roll-gacha');

    if (userState.medals < cost) {
        resultBox.innerHTML = '<span class="text-danger">メダルが足りません！（1回10メダル）<br>クエストをこなして報告ギルドで稼ぎましょう。</span>';
        resultBox.style.display = 'block';
        return;
    }

    // Deduct cost
    userState.medals -= cost;
    btn.disabled = true;
    btn.textContent = "ガチャ回転中...";
    resultBox.style.display = 'none';
    updateUI();

    // Mock animation delay
    await new Promise(r => setTimeout(r, 1500));

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
        <p><strong>${wonItem.name}</strong> を獲得しました！</p>
        <p class="text-small text-muted mt-2">コンテンツ錬成画面でセットして使用できます。</p>
    `;
    resultBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = "もう一度回す";
}

// --- Gamification (EXP & Leveling) ---
async function submitReport() {
    const keyword = document.getElementById('input-keyword').value || "不明なクエスト";
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
    // Medals: 1 medal per 50 EXP
    const expGained = Math.floor(imp / 10) + (conv * 50);
    const medalsGained = Math.max(1, Math.floor(expGained / 50)); // Minimum 1 medal for reporting anything > 0

    if (expGained <= 0) {
        msgBox.textContent = "成果を獲得できませんでした。もう少しインプレッションが必要です。";
        msgBox.className = "mt-3 text-muted text-center";
        msgBox.style.display = "block";
        return;
    }

    userState.exp += expGained;
    userState.medals += medalsGained;

    // Log to mock DB history
    await MockDB.logQuestResult({
        date: new Date().toISOString(),
        keyword: keyword,
        impressions: imp,
        conversions: conv,
        expGained: expGained
    });

    // Check level up
    let levelUpMsg = "";
    while (EXP_TABLE[userState.level] && userState.exp >= EXP_TABLE[userState.level]) {
        userState.level++;
        levelUpMsg = `\n🎉 レベルアップ！ レベル ${userState.level} になりました！`;
    }

    await saveState();
    updateUI();

    document.getElementById('input-keyword').value = '';
    document.getElementById('input-impressions').value = '';
    document.getElementById('input-conversions').value = '';

    msgBox.innerHTML = `<strong>${expGained} EXP</strong> と <strong class="text-gold"><i class="fa-solid fa-coins"></i> ${medalsGained} メダル</strong> を獲得しました！${levelUpMsg}`;
    msgBox.className = "mt-3 text-success text-center";
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
    document.getElementById('btn-roll-gacha').addEventListener('click', rollGacha);

    // Handle changing provider (clear password mask to avoid confusion)
    document.getElementById('ai-provider').addEventListener('change', (e) => {
        userState.aiProvider = e.target.value;
        // Optionally clear the API key field when switching to avoid saving the wrong key to the wrong provider
        // document.getElementById('api-key-input').value = "";
    });

    document.getElementById('btn-save-key').addEventListener('click', () => {
        const key = document.getElementById('api-key-input').value;
        const provider = document.getElementById('ai-provider').value;
        const msg = document.getElementById('settings-message');

        userState.aiProvider = provider;

        if (key && key !== "********") {
            userState.apiKey = key;
        }

        saveState();
        msg.textContent = "設定を保存しました。";
        msg.style.display = "block";
        updateUI();
        setTimeout(() => { msg.style.display = "none"; }, 3000);
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