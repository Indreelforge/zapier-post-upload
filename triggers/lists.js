'use strict';
const { baseUrl } = require('../lib');

// Hidden triggers that feed ID dropdowns, so nobody has to paste upload IDs.
const label = (u) => `${String(u.title || '(no caption)').slice(0, 60)} · ${u.profile_name || ''} · ${u.status}`;

module.exports = {
  scheduledPostList: {
    key: 'scheduled_post_list',
    noun: 'Scheduled Post',
    display: { label: 'List Scheduled Posts', description: 'Lists upcoming scheduled posts (used for dropdowns).', hidden: true },
    operation: {
      perform: async (z) => {
        const res = await z.request({ url: `${baseUrl()}/api/schedule` });
        return (res.data.scheduled_posts || []).map((p) => ({
          id: p.id,
          label: `${String(p.title || '(no caption)').slice(0, 60)} · ${p.scheduled_at}`,
          title: p.title,
          scheduled_at: p.scheduled_at,
          platforms: p.platforms,
        }));
      },
      sample: { id: 'upl_3f2a9c1d0b7e', label: 'Launch post · 2026-12-01T09:30:00.000Z', title: 'Launch post', scheduled_at: '2026-12-01T09:30:00.000Z', platforms: ['linkedin'] },
    },
  },
  uploadList: {
    key: 'upload_list',
    noun: 'Upload',
    display: { label: 'List Recent Uploads', description: 'Lists recent uploads (used for dropdowns).', hidden: true },
    operation: {
      inputFields: [{ key: 'status', label: 'Status', choices: ['completed', 'failed', 'partial', 'scheduled'] }],
      perform: async (z, bundle) => {
        const params = { limit: 50 };
        if (bundle.inputData && bundle.inputData.status) params.status = bundle.inputData.status;
        const res = await z.request({ url: `${baseUrl()}/api/uploads`, params });
        return (res.data.uploads || []).map((u) => ({ id: u.id, label: label(u), status: u.status, title: u.title }));
      },
      sample: { id: 'upl_3f2a9c1d0b7e', label: 'Launch post · my-brand · failed', status: 'failed', title: 'Launch post' },
    },
  },
  // Retry only accepts failed uploads, so its dropdown lists only those.
  failedUploadList: {
    key: 'failed_upload_list',
    noun: 'Upload',
    display: { label: 'List Failed Uploads', description: 'Lists recent failed uploads (used for dropdowns).', hidden: true },
    operation: {
      perform: async (z) => {
        const res = await z.request({ url: `${baseUrl()}/api/uploads`, params: { status: 'failed', limit: 50 } });
        return (res.data.uploads || []).map((u) => ({ id: u.id, label: label(u), status: u.status, title: u.title }));
      },
      sample: { id: 'upl_3f2a9c1d0b7e', label: 'Launch post · my-brand · failed', status: 'failed', title: 'Launch post' },
    },
  },
};
