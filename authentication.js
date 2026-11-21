'use strict';
const { baseUrl } = require('./lib');

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'password',
      helpText: 'Create a key in the [Post-Upload dashboard → API Keys](https://post-upload.com/dashboard/api-keys) (two-factor authentication must be on), then paste it here.',
    },
  ],
  test: { url: `${baseUrl()}/api/me` },
  connectionLabel: '{{email}}',
};
