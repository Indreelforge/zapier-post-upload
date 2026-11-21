# Post-Upload for Zapier

Official [Post-Upload](https://post-upload.com) integration for Zapier. Publish videos, photos and text to **16 social networks** from any Zap, schedule and manage posts, and start Zaps the moment a post is published or fails.

Instagram · YouTube · TikTok · Facebook · X (Twitter) · LinkedIn · Threads · Pinterest · Reddit · Bluesky · Google Business Profile · Discord · Telegram · Slack · Mastodon · WordPress

## Connect

Create an API key in the [Post-Upload dashboard → API Keys](https://post-upload.com/dashboard/api-keys) (two-factor authentication must be on) and paste it when Zapier asks for your **API Key**.

## Triggers (instant)

| Trigger | When |
|---|---|
| Upload Completed | A post is published on every selected platform |
| Upload Failed | A post fails on every platform; includes the error and suggested fix per platform |
| Upload Partially Failed | A post is published on some platforms and fails on others |
| Scheduled Post Published | A scheduled or queued post is published |

Each trigger can be limited to one profile. Turning a Zap on creates a [webhook subscription](https://docs.post-upload.com/api-reference/webhooks#webhook-subscriptions) with its own signing secret; turning it off removes it. Your account webhook is never changed. Webhooks need the Advanced plan or higher.

## Actions

| Action | What it does |
|---|---|
| Upload Video | Publish or schedule a video (file from a previous step or a public URL) |
| Upload Photos | Publish or schedule one photo or a carousel of up to 10 |
| Post Text | Publish or schedule a text post |
| Edit Scheduled Post | Change the date, title or description of a scheduled post |
| Cancel Scheduled Post | Cancel a scheduled post |
| Retry Failed Upload | Publish a failed upload again on the platforms that failed |
| Create Profile | Create a profile, e.g. one per client |
| Create Client Connect Link | Branded page where a client connects their own accounts (whitelabel plans) |

Every upload accepts **Schedule At**, **Add to Queue**, **First Comment**, **Your Reference** (deduplication) and **Platform Options** (for example `privacy_level` for TikTok, `pinterest_board_id`, `reddit_subreddit`). Uploads are processed in the background; use the triggers or **Find Upload** for the per-platform result.

## Searches

| Search | What it finds |
|---|---|
| Find Upload | An upload by upload ID or your reference, with its status per platform |
| Find Profile | A profile by name, with its connected accounts |

## Development

```bash
npm install
npm test                      # jest + nock, no network
npx zapier-platform-cli validate
npx zapier-platform-cli push  # needs `zapier login`
```

Set `POST_UPLOAD_API_BASE` (for example with `zapier env:set`) to test against another API host.

## License

MIT
