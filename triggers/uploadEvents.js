'use strict';
const crypto = require('crypto');
const { baseUrl } = require('../lib');

// Instant triggers on upload events, built on webhook subscriptions
// (POST /api/webhooks/subscriptions): Zapier subscribes when a Zap is turned
// on and unsubscribes when it is turned off. Each subscription has its own
// secret; deliveries are signed with X-Post-Upload-Signature.

// Static samples mirror a real webhook delivery (services/uploadService.js
// sendWebhookNotification in the API), minus the internal user_id.
const baseSample = {
  id: 'upl_3f2a9c1d0b7e:upload.completed',
  event: 'upload.completed',
  upload_id: 'upl_3f2a9c1d0b7e',
  timestamp: '2026-11-21T10:30:01.000Z',
  data: {
    title: 'Our new product is live',
    upload_type: 'video',
    platforms: ['instagram', 'tiktok'],
    platform_statuses: { instagram: 'completed', tiktok: 'completed' },
    platform_post_ids: { instagram: '17890000000000000', tiktok: '7300000000000000000' },
    profile: 'my-brand',
  },
  request_id: 'upl_3f2a9c1d0b7e',
  status: 'completed',
  completed_at: '2026-11-21T10:30:00.000Z',
};
const sample = baseSample;

const failure = {
  message: 'TikTok rejected the video',
  platform_errors: { tiktok: { platform: 'tiktok', error: 'Video is shorter than 3 seconds', error_code: 'VIDEO_TOO_SHORT' } },
};

function sampleFor(event, status) {
  const s = { ...baseSample, id: `upl_3f2a9c1d0b7e:${event}`, event, status, data: { ...baseSample.data } };
  if (status === 'failed') {
    s.data.platform_statuses = { instagram: 'failed', tiktok: 'failed' };
    delete s.data.platform_post_ids;
  }
  if (status === 'partial') {
    s.data.platform_statuses = { instagram: 'completed', tiktok: 'failed' };
    s.data.platform_post_ids = { instagram: '17890000000000000' };
  }
  if (status === 'failed' || status === 'partial') {
    s.platform_errors = failure.platform_errors;
    s.error_message = JSON.stringify(failure);
    s.error_details = failure;
  }
  return s;
}

function parseError(raw) {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return { message: String(raw) }; }
}

function signatureValid(secret, raw, header) {
  if (!secret || !header || typeof raw !== 'string') return false;
  const expected = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex'));
  const given = Buffer.from(String(header).trim());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Turns a history row into the same shape as a webhook event (for samples). */
function fromUpload(u, event) {
  const errorDetails = parseError(u.error_message);
  const platformErrors = errorDetails && errorDetails.platform_errors && Object.keys(errorDetails.platform_errors).length
    ? errorDetails.platform_errors : undefined;
  return {
    id: `${u.id}:${event}`,
    event,
    upload_id: u.id,
    timestamp: u.completed_at || u.created_at,
    data: {
      title: u.title,
      upload_type: u.upload_type,
      platforms: u.platforms,
      platform_statuses: u.platform_statuses,
      platform_post_ids: u.platform_post_ids || undefined,
      profile: u.profile_name || undefined,
      parent_upload_id: u.parent_upload_id || undefined,
    },
    request_id: u.request_id || u.id,
    status: u.status,
    platform_errors: platformErrors,
    error_message: u.error_message || undefined,
    error_details: errorDetails,
    completed_at: u.completed_at || undefined,
  };
}

const PLAN_NOTE = ' Needs the Post-Upload Advanced plan or higher (webhooks).';

function makeTrigger({ key, event, label, description, status }) {
  return {
    key,
    noun: 'Upload',
    display: { label, description: description + PLAN_NOTE },
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
        const raw = bundle.rawRequest && bundle.rawRequest.content;
        // Prefer the signed raw body: Zapier's cleanedRequest also parses JSON
        // inside strings (error_message would become an object) and adds a
        // querystring key, so it would not match the polling sample.
        let payload = null;
        if (typeof raw === 'string' && raw) {
          try { payload = JSON.parse(raw); } catch (e) { payload = null; }
        }
        if (!payload || typeof payload !== 'object') {
          const { querystring: _qs, ...cleaned } = bundle.cleanedRequest || {};
          payload = cleaned;
        }
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
        // user_id is Post-Upload's internal account number: not useful in a Zap.
        const { user_id: _internal, ...rest } = payload;
        return [{ id: `${payload.upload_id}:${payload.event}`, ...rest }];
      },
      performList: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/uploads`, params: { status, limit: 25 } });
        let uploads = res.data.uploads || [];
        if (bundle.inputData.profile) uploads = uploads.filter((u) => u.profile_name === bundle.inputData.profile);
        if (event === 'scheduled_post_published') uploads = uploads.filter((u) => u.scheduled_at);
        if (event === 'upload.completed') uploads = uploads.filter((u) => !u.scheduled_at);
        return uploads.slice(0, 3).map((u) => fromUpload(u, event));
      },
      sample: sampleFor(event, status),
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
