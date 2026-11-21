'use strict';
const { version } = require('./package.json');
const { version: platformVersion } = require('zapier-platform-core');
const authentication = require('./authentication');
const profileList = require('./triggers/profileList');
const events = require('./triggers/uploadEvents');
const uploads = require('./creates/uploads');
const manage = require('./creates/manage');
const searches = require('./searches');
const lists = require('./triggers/lists');

// Every request carries the API key.
const addApiKey = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = { ...(request.headers || {}), Authorization: `Apikey ${bundle.authData.api_key}` };
  }
  request.headers = { 'User-Agent': `zapier-post-upload/${version}`, ...request.headers };
  return request;
};

// Show the API's own message ("Platform(s) not connected: bluesky…") instead
// of Zapier's generic "got 400" error.
const handleErrors = (response, z) => {
  if (response.status < 400 || response.skipThrowForStatus) return response;
  let body = {};
  try { body = typeof response.data === 'object' && response.data ? response.data : JSON.parse(response.content || '{}'); } catch (e) { body = {}; }
  const message = body.error || body.message || `Post-Upload returned HTTP ${response.status}`;
  if (response.status === 401) throw new z.errors.Error(`${message}. Check your Post-Upload API key.`, 'AuthenticationError', 401);
  if (response.status === 429) throw new z.errors.ThrottledError(message, 60);
  throw new z.errors.Error(message, body.error_code || `HTTP_${response.status}`, response.status);
};

const byKey = (list) => Object.fromEntries(list.map((x) => [x.key, x]));

module.exports = {
  version,
  platformVersion,
  authentication,
  beforeRequest: [addApiKey],
  afterResponse: [handleErrors],
  triggers: byKey([
    events.uploadCompleted,
    events.uploadFailed,
    events.uploadPartial,
    events.scheduledPostPublished,
    profileList,
    lists.scheduledPostList,
    lists.uploadList,
    lists.failedUploadList,
  ]),
  creates: byKey([
    uploads.uploadVideo,
    uploads.uploadPhotos,
    uploads.postText,
    manage.editScheduledPost,
    manage.cancelScheduledPost,
    manage.retryUpload,
    manage.createProfile,
    manage.getConnectLink,
  ]),
  searches: byKey([searches.findUpload, searches.findProfile]),
  searchOrCreates: {},
  // Inputs arrive exactly as mapped (no automatic cleaning); lib.js skips empty values.
  flags: { cleanInputData: false },
};
