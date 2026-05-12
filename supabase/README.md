# Content Alchemist - Backend Integration

## Stripe Webhook Setup

SaaSの月額課金を有効にし、決済完了時に自動でユーザーに「PRO権限」を付与するためには、StripeのWebhookを利用します。
本ディレクトリにある `functions/stripe-webhook/index.ts` は、Supabase Edge Functionsとしてデプロイされるコードです。

### デプロイ手順 (Supabase CLI を使用)

1. Supabaseプロジェクトへのログイン:
   \`\`\`bash
   supabase login
   supabase link --project-ref <your-project-ref>
   \`\`\`

2. 環境変数の設定 (Stripeダッシュボードから取得):
   \`\`\`bash
   supabase secrets set STRIPE_SECRET_KEY="sk_test_..."
   supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
   \`\`\`

3. Edge Function のデプロイ:
   \`\`\`bash
   supabase functions deploy stripe-webhook --no-verify-jwt
   \`\`\`

4. Stripe側の設定:
   Stripeダッシュボードの「開発者」>「Webhook」から、エンドポイントを追加します。
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
   - リッスンするイベント: `checkout.session.completed`

これにより、ユーザーが決済を完了すると自動的に `auth.users` の `user_metadata.is_pro` が `true` に更新され、アプリ内でPRO機能が解放されます。

### クーポン・無料枠（インフルエンサー招待）の発行方法

テストユーザーやインフルエンサーにPROプランを無料で提供したい場合は、システムコードを書き換えることなく、Stripeの標準機能で「100%OFFクーポン（プロモーションコード）」を発行するのが最も安全で確実です。

1. **Stripeダッシュボードでクーポンを作成**
   - Stripeのメニューから「商品カタログ」>「クーポン」へ移動します。
   - 「新規作成」をクリックし、「100% オフ」「期間：永久（または一定期間）」のクーポンを作成します。
   - 同時に「顧客向けのプロモーションコード」をオンにして、任意の合言葉（例: `VIPFREE`）を設定します。

2. **決済ページ（Payment Links）の設定**
   - PROプランの支払いリンク（Payment Links）を作成または編集します。
   - 「高度なオプション」から「プロモーションコードを許可」のチェックを入れます。

3. **運用フロー**
   - ユーザーはアプリの「PROにアップグレード」ボタンを押し、Stripeの決済画面に進みます。
   - 決済画面でプロモーションコード（例: `VIPFREE`）を入力すると請求額が0円になり、クレジットカード決済を通さずに登録が完了します。
   - 決済完了イベントがWebhook経由でSupabaseに送信され、自動的にアプリ内でPRO権限が解放されます。
