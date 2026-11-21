'use strict';
const { baseUrl } = require('../lib');

// Hidden trigger that feeds the Profile dropdowns.
module.exports = {
  key: 'profile_list',
  noun: 'Profile',
  display: { label: 'List Profiles', description: 'Lists your Post-Upload profiles (used for dropdowns).', hidden: true },
  operation: {
    perform: async (z) => {
      const res = await z.request({ url: `${baseUrl()}/api/profiles` });
      return (res.data.profiles || []).map((p) => ({ id: p.id, name: p.name, locked: Boolean(p.locked) }));
    },
    sample: { id: 'b1f0c6c2-7d1a-4a2e-9d8a-0c7f5c1e2a11', name: 'my-brand', locked: false },
  },
};
