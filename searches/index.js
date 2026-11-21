'use strict';
const { baseUrl } = require('../lib');

module.exports = {
  findUpload: {
    key: 'find_upload',
    noun: 'Upload',
    display: { label: 'Find Upload', description: 'Finds an upload by its upload ID or your request ID and returns its per-platform status.' },
    operation: {
      inputFields: [{ key: 'request_id', label: 'Upload', required: true, dynamic: 'upload_list.id.label', helpText: 'Pick an upload, or map an upload ID (upl_…) or your own reference.' }],
      perform: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/uploadposts/status`, params: { request_id: bundle.inputData.request_id }, skipThrowForStatus: true });
        if (res.status === 404) return [];
        res.throwForStatus();
        return [{ id: res.data.upload_id || bundle.inputData.request_id, ...res.data }];
      },
      sample: {
        id: 'upl_3f2a9c1d0b7e',
        upload_id: 'upl_3f2a9c1d0b7e',
        status: 'completed',
        platforms: { instagram: 'completed', tiktok: 'completed' },
        platform_post_ids: { instagram: '17890000000000000', tiktok: '7300000000000000000' },
      },
    },
  },

  findProfile: {
    key: 'find_profile',
    noun: 'Profile',
    display: { label: 'Find Profile', description: 'Finds a profile by name and returns its connected accounts.' },
    operation: {
      inputFields: [{ key: 'name', label: 'Profile Name', required: true }],
      perform: async (z, bundle) => {
        const res = await z.request({ url: `${baseUrl()}/api/profiles/${encodeURIComponent(bundle.inputData.name)}`, skipThrowForStatus: true });
        if (res.status === 404) return [];
        res.throwForStatus();
        const p = res.data.profile || res.data;
        return [{ id: p.id || bundle.inputData.name, ...p }];
      },
      sample: { id: 'b1f0c6c2-7d1a-4a2e-9d8a-0c7f5c1e2a11', name: 'my-brand' },
    },
  },
};
