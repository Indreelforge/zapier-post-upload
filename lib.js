'use strict';

// Override for testing against the dev API: zapier env:set 1.0.0 POST_UPLOAD_API_BASE=https://api-dev.post-upload.com
const baseUrl = () => (process.env.POST_UPLOAD_API_BASE || 'https://api.post-upload.com').replace(/\/$/, '');

const LABELS = {
  bluesky: 'Bluesky',
  discord: 'Discord',
  facebook: 'Facebook',
  google_business: 'Google Business Profile',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  slack: 'Slack',
  telegram: 'Telegram',
  threads: 'Threads',
  tiktok: 'TikTok',
  wordpress: 'WordPress',
  x: 'X (Twitter)',
  youtube: 'YouTube',
};
// What each platform accepts, mirroring shared/platforms.json.
const VIDEO = ['bluesky', 'discord', 'facebook', 'instagram', 'linkedin', 'mastodon', 'pinterest', 'telegram', 'threads', 'tiktok', 'wordpress', 'x', 'youtube'];
const PHOTO = ['bluesky', 'discord', 'facebook', 'google_business', 'instagram', 'linkedin', 'mastodon', 'pinterest', 'telegram', 'threads', 'tiktok', 'wordpress', 'x'];
const TEXT = ['bluesky', 'discord', 'facebook', 'google_business', 'linkedin', 'mastodon', 'reddit', 'slack', 'telegram', 'threads', 'wordpress', 'x'];
const choices = (keys) => keys.map((value) => ({ value, sample: value, label: LABELS[value] }));

const profileField = {
  key: 'profile',
  label: 'Profile',
  required: true,
  dynamic: 'profile_list.name.name',
  helpText: 'The Post-Upload profile to post from. Its social accounts are connected in the [Post-Upload dashboard](https://post-upload.com/dashboard/users).',
};

const platformsField = (keys, what) => ({
  key: 'platforms',
  label: 'Platforms',
  required: true,
  list: true,
  choices: choices(keys),
  helpText: `Networks to publish the ${what} to. Each must be connected to the profile.`,
});

// Fields shared by every upload action.
const commonUploadFields = [
  {
    key: 'title',
    label: 'Title / Caption',
    required: true,
    type: 'text',
    helpText: 'The post text. It is the video title on YouTube and the caption everywhere else.',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'text',
    helpText: 'Optional longer text: the YouTube description, and added below the title on the other networks.',
  },
  { key: 'schedule', label: 'Schedule At', type: 'datetime', helpText: 'Publish later at this date and time. Leave empty to publish now.' },
  { key: 'timezone', label: 'Timezone', helpText: 'IANA timezone of Schedule At, e.g. America/New_York.' },
  { key: 'add_to_queue', label: 'Add to Queue', type: 'boolean', default: 'no', helpText: 'Post at the profile’s next free queue slot instead of now.' },
  { key: 'first_comment', label: 'First Comment', helpText: 'Posted as the first comment right after publishing (Instagram, Facebook, X, LinkedIn, Threads, YouTube, Bluesky, Reddit).' },
  { key: 'reference', label: 'Your Reference', helpText: 'Your own unique ID for this post (sent as request_id). Find Upload accepts it later.' },
  {
    key: 'platform_options',
    label: 'Platform Options',
    dict: true,
    helpText: 'Platform-specific settings sent as-is, e.g. `privacy_level` (required for TikTok), `pinterest_board_id`, `reddit_subreddit`, `youtube_privacy`. See [the platform guides](https://docs.post-upload.com/platform-guides/tiktok).',
  },
];

const truthy = (v) => v === true || v === 'true' || v === 'yes';
const present = (v) => v !== undefined && v !== null && v !== '';

/** JSON body for /api/upload, /api/upload_photos and /api/upload_text. */
function uploadBody(input) {
  const body = {
    user: input.profile,
    title: input.title,
    platforms: input.platforms,
    async_upload: true,
  };
  if (present(input.description)) body.description = input.description;
  if (input.schedule) body.schedule = input.schedule;
  if (input.timezone) body.timezone = input.timezone;
  if (truthy(input.add_to_queue)) body.add_to_queue = true;
  if (input.first_comment) body.first_comment = input.first_comment;
  if (input.reference) body.request_id = input.reference;
  for (const [k, v] of Object.entries(input.platform_options || {})) {
    if (k && v !== undefined && v !== '') body[k] = v;
  }
  return body;
}

module.exports = { baseUrl, choices, VIDEO, PHOTO, TEXT, profileField, platformsField, commonUploadFields, uploadBody, truthy };
