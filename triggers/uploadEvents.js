'use strict';
const crypto = require('crypto');
const { baseUrl } = require('../lib');

// Instant triggers on upload events, built on webhook subscriptions
// (POST /api/webhooks/subscriptions): Zapier subscribes when a Zap is turned
// on and unsubscribes when it is turned off. Each subscription has its own
// secret; deliveries are signed with X-Post-Upload-Signature.

const sample = {
  id: 'upl_3f2a9c1d0b7e:upload.completed',
  event: 'upload.completed',
  upload_id: 'upl_3f2a9c1d0b7e',
  timestamp: '2026-11-21T10:30:01.000Z',
  status: 'completed',
  request_id: 'upl_3f2a9c1d0b7e',
  data: {
    title: 'Our new product is live',
    upload_type: 'video',
    platforms: ['instagram', 'tiktok'],
    platform_statuses: { instagram: 'completed', tiktok: 'completed' },
    platform_post_ids: { instagram: '17890000000000000', tiktok: '7300000000000000000' },
    profile: 'my-brand',
  },
  completed_at: '2026-11-21T10:30:00.000Z',
};

function signatureValid(secret, raw, header) {
  if (!secret || !header || typeof raw !== 'string') return false;
  const expected = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex'));
  const given = Buffer.from(String(header).trim());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Turns a history row into the same shape as a webhook event (for samples). */
function fromUpload(u, event) {
  return {
    id: `${u.id}:${event}`,
    event,
    upload_id: u.id,
    timestamp: u.completed_at || u.created_at,
    status: u.status,
    request_id: u.request_id || u.id,
    data: {
      title: u.title,
      upload_type: u.upload_type,
      platforms: u.platforms,
      platform_statuses: u.platform_statuses,
      platform_post_ids: u.platform_post_ids || undefined,
      profile: u.profile_name || undefined,
    },
    error_message: u.error_message || undefined,
    completed_at: u.completed_at || undefined,
  };
}

function makeTrigger({ key, event, label, description, status }) {
  return {
    key,
    noun: 'Upload',
    display: { label, description },
    operation: {
      type: 'hook',
      inputFields: [
        {
          key: 'profile',
          label: 'Profile',
          dynamic: 'profile_list.name.name',
          helpText: 'Only trigger for this profile. Leave empty for every profile.',
        },
      ],
      performSubscribe: async (z, bundle) => {
        const body = { url: bundle.targetUrl, events: [event], source: 'zapier', name: `Zapier: ${label}` };
        if (bundle.inputData.profile) body.profile = bundle.inputData.profile;
        const res = await z.request({ url: `${baseUrl()}/api/webhooks/subscriptions`, method: 'POST', body });
        return { id: res.data.subscription.id, secret: res.data.secret };
      },
      performUnsubscribe: async (z, bundle) => {
        const id = bundle.subscribeData && bundle.subscribeData.id;
        if (!id) return {};
        const res = await z.request({
          url: `${baseUrl()}/api/webhooks/subscriptions/${encodeURIComponent(id)}`,
          method: 'DELETE',
          skipThrowForStatus: true,
        });
        if (res.status >= 400 && res.status !== 404) throw new z.errors.Error(`Could not remove the Post-Upload webhook (HTTP ${res.status})`, 'UnsubscribeFailed', res.status);
        return {};
      },
      perform: async (z, bundle) => {
        const payload = bundle.cleanedRequest || {};
        const raw = bundle.rawRequest && bundle.rawRequest.content;
        const secret = bundle.subscribeData && bundle.subscribeData.secret;
        if (secret && raw) {
          const headers = (bundle.rawRequest && bundle.rawRequest.headers) || {};
          const header = headers['Http-X-Post-Upload-Signature'] || headers['X-Post-Upload-Signature'] || headers['x-post-upload-signature'];
          if (!signatureValid(secret, raw, header)) {
            z.console.log('Post-Upload: ignored a request with a missing or invalid signature');
            return [];
          }
        }
        if (payload.event === 'test') return [{ ...sample, id: `test:${payload.timestamp || Date.now()}`, event: 'test' }];
        if (payload.event !== event) return [];
        return [{ id: `${payload.upload_id}:${payload.event}`, ...payload }];
      },
      performList: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/uploads`, params: { status, limit: 25 } });
        let uploads = res.data.uploads || [];
        if (bundle.inputData.profile) uploads = uploads.filter((u) => u.profile_name === bundle.inputData.profile);
        if (event === 'scheduled_post_published') uploads = uploads.filter((u) => u.scheduled_at);
        if (event === 'upload.completed') uploads = uploads.filter((u) => !u.scheduled_at);
        return uploads.slice(0, 3).map((u) => fromUpload(u, event));
      },
      sample: { ...sample, id: `upl_3f2a9c1d0b7e:${event}`, event, status },
    },
  };
}

module.exports = {
  signatureValid,
  uploadCompleted: makeTrigger({
    key: 'upload_completed',
    event: 'upload.completed',
    status: 'completed',
    label: 'Upload Completed',
    description: 'Triggers when a post is published on every selected platform.',
  }),
  uploadFailed: makeTrigger({
    key: 'upload_failed',
    event: 'upload.failed',
    status: 'failed',
    label: 'Upload Failed',
    description: 'Triggers when a post fails on every selected platform, with the error and suggested fix per platform.',
  }),
  uploadPartial: makeTrigger({
    key: 'upload_partial',
    event: 'upload.partial',
    status: 'partial',
    label: 'Upload Partially Failed',
    description: 'Triggers when a post is published on some platforms and fails on others.',
  }),
  scheduledPostPublished: makeTrigger({
    key: 'scheduled_post_published',
    event: 'scheduled_post_published',
    status: 'completed',
    label: 'Scheduled Post Published',
    description: 'Triggers when a scheduled or queued post is published.',
  }),
};
