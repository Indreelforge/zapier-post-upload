'use strict';
const { baseUrl } = require('../lib');

const enc = encodeURIComponent;

module.exports = {
  editScheduledPost: {
    key: 'edit_scheduled_post',
    noun: 'Scheduled Post',
    display: { label: 'Edit Scheduled Post', description: 'Changes the date, title or description of a scheduled post.' },
    operation: {
      inputFields: [
        { key: 'job_id', label: 'Scheduled Post', required: true, dynamic: 'scheduled_post_list.id.label', helpText: 'Pick a scheduled post, or map its upload ID (upl_…).' },
        { key: 'scheduled_date', label: 'New Date and Time', type: 'datetime' },
        { key: 'timezone', label: 'Timezone', helpText: 'IANA timezone of the new date, e.g. Europe/London.' },
        { key: 'title', label: 'New Title / Caption', type: 'text' },
        { key: 'caption', label: 'New Description', type: 'text' },
      ],
      perform: async (z, bundle) => {
        const { job_id, ...rest } = bundle.inputData;
        const body = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== ''));
        const res = await z.request({ url: `${baseUrl()}/api/schedule/${enc(job_id)}`, method: 'PATCH', body });
        return res.data;
      },
      sample: {
        success: true,
        message: 'Scheduled post updated',
        post: { id: 'upl_3f2a9c1d0b7e', title: 'Launch post', caption: null, scheduled_date: '2026-12-01T09:30:00.000Z', platforms: ['linkedin'] },
      },
    },
  },

  cancelScheduledPost: {
    key: 'cancel_scheduled_post',
    noun: 'Scheduled Post',
    display: { label: 'Cancel Scheduled Post', description: 'Cancels a scheduled post before it is published.' },
    operation: {
      inputFields: [{ key: 'job_id', label: 'Scheduled Post', required: true, dynamic: 'scheduled_post_list.id.label', helpText: 'Pick a scheduled post, or map its upload ID (upl_…).' }],
      perform: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/schedule/${enc(bundle.inputData.job_id)}`, method: 'DELETE' });
        return { id: bundle.inputData.job_id, ...res.data };
      },
      sample: { id: 'upl_3f2a9c1d0b7e', success: true, message: 'Scheduled post cancelled successfully' },
    },
  },

  retryUpload: {
    key: 'retry_upload',
    noun: 'Upload',
    display: { label: 'Retry Failed Upload', description: 'Publishes a failed upload again on the platforms that failed (paid plans).' },
    operation: {
      inputFields: [{ key: 'upload_id', label: 'Upload', required: true, dynamic: 'failed_upload_list.id.label', helpText: 'Pick a failed upload, or map its upload ID (upl_…) from the Upload Failed trigger.' }],
      perform: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/uploads/${enc(bundle.inputData.upload_id)}/retry`, method: 'POST' });
        return res.data;
      },
      sample: { success: true, message: 'Upload retry queued successfully', upload_id: 'upl_3f2a9c1d0b7e', new_status: 'queued', retry_platforms: ['tiktok'] },
    },
  },

  createProfile: {
    key: 'create_profile',
    noun: 'Profile',
    display: { label: 'Create Profile', description: 'Creates a Post-Upload profile, e.g. one per client or brand.' },
    operation: {
      inputFields: [{ key: 'name', label: 'Profile Name', required: true, helpText: '3–50 characters.' }],
      perform: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/profiles`, method: 'POST', body: { name: bundle.inputData.name } });
        return res.data;
      },
      sample: { success: true, profile: { id: 'b1f0c6c2-7d1a-4a2e-9d8a-0c7f5c1e2a11', name: 'client-acme', owner_id: 1234, status: 'active', connections: [] } },
    },
  },

  getConnectLink: {
    key: 'get_connect_link',
    noun: 'Connect Link',
    display: { label: 'Create Client Connect Link', description: 'Creates a branded page where your client connects their own social accounts to a profile (whitelabel plans).' },
    operation: {
      inputFields: [
        { key: 'username', label: 'Profile', required: true, dynamic: 'profile_list.name.name' },
        { key: 'redirect_url', label: 'Redirect URL', helpText: 'Https URL of the “Back to app” button.' },
        { key: 'logo_image', label: 'Logo URL' },
        { key: 'connect_title', label: 'Page Title' },
        { key: 'expires_in_hours', label: 'Expires In (Hours)', type: 'integer', default: '48' },
      ],
      perform: async (z, bundle) => {
        const body = Object.fromEntries(Object.entries(bundle.inputData).filter(([, v]) => v !== undefined && v !== ''));
        if (body.expires_in_hours) body.expires_in_hours = Number(body.expires_in_hours);
        const res = await z.request({ url: `${baseUrl()}/api/whitelabel/generate-jwt`, method: 'POST', body });
        return res.data;
      },
      sample: { success: true, access_url: 'https://post-upload.com/connect/abc123', expires_at: '2026-11-23T10:00:00.000Z' },
    },
  },
};
