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
