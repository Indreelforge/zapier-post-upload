'use strict';
const { baseUrl, VIDEO, PHOTO, TEXT, profileField, platformsField, commonUploadFields, uploadBody } = require('../lib');

// Uploads run asynchronously (Zapier actions must finish within ~30 s): the
// response carries data.upload_id, and the "Upload Completed / Failed"
// triggers (or Find Upload) report the per-platform result.
// Samples mirror the live API responses of each endpoint.
const queued = (message, extra = {}) => ({
  success: true,
  message,
  request_id: 'upl_3f2a9c1d0b7e',
  data: { upload_id: 'upl_3f2a9c1d0b7e', platforms: { instagram: 'queued', tiktok: 'queued' }, total_platforms: 2, ...extra },
});
const videoSample = {
  ...queued('Video URL accepted — downloading and processing asynchronously', { source: 'url', estimated_completion: '30s' }),
  warnings: [],
};
const photoSample = queued('Photo upload queued successfully');
const textSample = {
  ...queued('Text post queued successfully'),
  data: { upload_id: 'upl_3f2a9c1d0b7e', platforms: { linkedin: 'queued', x: 'queued' }, total_platforms: 2 },
};
const outputFields = [
  { key: 'data__upload_id', label: 'Upload ID' },
  { key: 'request_id', label: 'Request ID' },
  { key: 'message', label: 'Message' },
  { key: 'success', label: 'Success', type: 'boolean' },
  { key: 'data__total_platforms', label: 'Total Platforms', type: 'integer' },
];

const post = (path) => async (z, bundle, extra = {}) => {
  const res = await z.request({ url: `${baseUrl()}${path}`, method: 'POST', body: { ...uploadBody(bundle.inputData), ...extra } });
  return res.data;
};

module.exports = {
  uploadVideo: {
    key: 'upload_video',
    noun: 'Video',
    display: { label: 'Upload Video', description: 'Publishes or schedules a video on Instagram, YouTube, TikTok, Facebook, X, LinkedIn and more.' },
    operation: {
      inputFields: [
        profileField,
        platformsField(VIDEO, 'video'),
        {
          key: 'video',
          label: 'Video',
          required: true,
          type: 'file',
          helpText: 'A video file from a previous step, or a public URL of the video. Post-Upload downloads it.',
        },
        ...commonUploadFields,
      ],
      perform: async (z, bundle) => post('/api/upload')(z, bundle, { video_url: bundle.inputData.video }),
      sample: videoSample,
      outputFields,
    },
  },

  uploadPhotos: {
    key: 'upload_photos',
    noun: 'Photo',
    display: { label: 'Upload Photos', description: 'Publishes or schedules one photo or a carousel of up to 10.' },
    operation: {
      inputFields: [
        profileField,
        platformsField(PHOTO, 'photos'),
        {
          key: 'photos',
          label: 'Photos',
          required: true,
          list: true,
          type: 'file',
          helpText: 'Up to 10 photo files from previous steps, or public photo URLs. Several photos become a carousel where the network supports it.',
        },
        ...commonUploadFields,
      ],
      perform: async (z, bundle) => post('/api/upload_photos')(z, bundle, { photo_urls: [].concat(bundle.inputData.photos || []).filter(Boolean) }),
      sample: photoSample,
      outputFields,
    },
  },

  postText: {
    key: 'post_text',
    noun: 'Post',
    display: { label: 'Post Text', description: 'Publishes or schedules a text post on X, LinkedIn, Facebook, Threads, Bluesky, Discord, Slack, Telegram and more.' },
    operation: {
      inputFields: [profileField, platformsField(TEXT, 'text post'), ...commonUploadFields],
      perform: async (z, bundle) => post('/api/upload_text')(z, bundle),
      sample: textSample,
      outputFields,
    },
  },
};
