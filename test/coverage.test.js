'use strict';
const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
const API = 'https://api.post-upload.com';
const authData = { api_key: 'test-key' };
afterEach(() => nock.cleanAll());

// Every trigger, action and search of the app must appear here, so a new one
// cannot ship without a test.
const TESTED = {
  triggers: ['upload_completed', 'upload_failed', 'upload_partial', 'scheduled_post_published', 'profile_list', 'scheduled_post_list', 'upload_list'],
  creates: ['upload_video', 'upload_photos', 'post_text', 'edit_scheduled_post', 'cancel_scheduled_post', 'retry_upload', 'create_profile', 'get_connect_link'],
  searches: ['find_upload', 'find_profile'],
};

describe('coverage', () => {
  it('every trigger, action and search is listed as tested', () => {
    for (const kind of Object.keys(TESTED)) expect(Object.keys(App[kind]).sort()).toEqual([...TESTED[kind]].sort());
  });
  it('every visible trigger, action and search has a label, description and sample', () => {
    for (const kind of Object.keys(TESTED)) {
      for (const def of Object.values(App[kind])) {
        expect(def.display.label).toBeTruthy();
        expect(def.display.description.length).toBeGreaterThan(20);
        expect(def.operation.sample).toBeTruthy();
      }
    }
  });
});

describe('instant triggers: event filtering and samples', () => {
  const cases = [
    ['upload_completed', 'upload.completed', 'completed'],
    ['upload_partial', 'upload.partial', 'partial'],
    ['scheduled_post_published', 'scheduled_post_published', 'completed'],
  ];
  for (const [key, event, status] of cases) {
    it(`${key} subscribes to ${event} only and passes only that event`, async () => {
      let sent;
      nock(API).post('/api/webhooks/subscriptions', (b) => { sent = b; return true; }).reply(201, { subscription: { id: 'whs_9' }, secret: 's' });
      await appTester(App.triggers[key].operation.performSubscribe, { authData, targetUrl: 'https://hooks.zapier.test/x', inputData: {} });
      expect(sent.events).toEqual([event]);
      expect(sent.profile).toBeUndefined();
      const pass = await appTester(App.triggers[key].operation.perform, { cleanedRequest: { event, upload_id: 'upl_1' } });
      expect(pass).toHaveLength(1);
      const other = await appTester(App.triggers[key].operation.perform, { cleanedRequest: { event: 'upload.failed', upload_id: 'upl_1' } });
      expect(other).toEqual([]);
    });
    it(`${key} builds samples from history with status=${status}`, async () => {
      nock(API).get('/api/uploads').query({ status, limit: 25 }).reply(200, {
        uploads: [
          { id: 'upl_a', status, scheduled_at: '2026-11-21T09:00:00Z', profile_name: 'brand' },
          { id: 'upl_b', status, scheduled_at: null, profile_name: 'other' },
        ],
      });
      const res = await appTester(App.triggers[key].operation.performList, { authData, inputData: { profile: 'brand' } });
      if (key === 'upload_completed') expect(res).toEqual([]); // the only brand upload was a scheduled one
      else expect(res.map((r) => r.upload_id)).toEqual(['upl_a']);
    });
  }
  it('Zapier "test" events always pass so the Zap editor can be tested', async () => {
    const res = await appTester(App.triggers.upload_failed.operation.perform, { cleanedRequest: { event: 'test', timestamp: 't1' } });
    expect(res[0]).toMatchObject({ id: 'test:t1', event: 'test' });
  });
  it('unsubscribe surfaces real failures', async () => {
    nock(API).delete('/api/webhooks/subscriptions/whs_1').reply(500, { error: 'boom' });
    await expect(appTester(App.triggers.upload_failed.operation.performUnsubscribe, { authData, subscribeData: { id: 'whs_1' } })).rejects.toThrow(/HTTP 500|boom/);
  });
});

describe('dropdown triggers', () => {
  it('profile_list maps profiles', async () => {
    nock(API).get('/api/profiles').reply(200, { profiles: [{ id: 'p1', name: 'brand', locked: true }] });
    expect(await appTester(App.triggers.profile_list.operation.perform, { authData })).toEqual([{ id: 'p1', name: 'brand', locked: true }]);
  });
  it('scheduled_post_list labels posts with title and time', async () => {
    nock(API).get('/api/schedule').reply(200, { scheduled_posts: [{ id: 'upl_s', title: 'Launch', scheduled_at: '2026-12-01T09:30:00Z', platforms: ['x'] }] });
    const res = await appTester(App.triggers.scheduled_post_list.operation.perform, { authData });
    expect(res[0]).toMatchObject({ id: 'upl_s', label: 'Launch · 2026-12-01T09:30:00Z' });
  });
  it('upload_list passes the status filter', async () => {
    nock(API).get('/api/uploads').query({ limit: 50, status: 'failed' }).reply(200, { uploads: [{ id: 'upl_f', title: 'T', status: 'failed', profile_name: 'brand' }] });
    const res = await appTester(App.triggers.upload_list.operation.perform, { authData, inputData: { status: 'failed' } });
    expect(res[0]).toMatchObject({ id: 'upl_f', status: 'failed' });
  });
});

describe('management actions', () => {
  it('cancel_scheduled_post deletes the scheduled post', async () => {
    nock(API).delete('/api/schedule/upl_s').reply(200, { success: true });
    expect(await appTester(App.creates.cancel_scheduled_post.operation.perform, { authData, inputData: { job_id: 'upl_s' } })).toMatchObject({ id: 'upl_s', success: true });
  });
  it('retry_upload posts to the retry endpoint', async () => {
    nock(API).post('/api/uploads/upl_f/retry').reply(200, { success: true, new_status: 'queued' });
    expect(await appTester(App.creates.retry_upload.operation.perform, { authData, inputData: { upload_id: 'upl_f' } })).toMatchObject({ new_status: 'queued' });
  });
  it('create_profile sends the name', async () => {
    let sent;
    nock(API).post('/api/profiles', (b) => { sent = b; return true; }).reply(201, { success: true });
    await appTester(App.creates.create_profile.operation.perform, { authData, inputData: { name: 'client-acme' } });
    expect(sent).toEqual({ name: 'client-acme' });
  });
  it('get_connect_link sends only set fields, with a numeric expiry', async () => {
    let sent;
    nock(API).post('/api/whitelabel/generate-jwt', (b) => { sent = b; return true; }).reply(200, { access_url: 'https://post-upload.com/connect/x' });
    await appTester(App.creates.get_connect_link.operation.perform, { authData, inputData: { username: 'brand', expires_in_hours: '24', logo_image: '' } });
    expect(sent).toEqual({ username: 'brand', expires_in_hours: 24 });
  });
});

describe('searches and errors', () => {
  it('find_upload returns the upload with an id', async () => {
    nock(API).get('/api/uploadposts/status').query({ request_id: 'row-7' }).reply(200, { upload_id: 'upl_1', status: 'completed' });
    expect(await appTester(App.searches.find_upload.operation.perform, { authData, inputData: { request_id: 'row-7' } })).toEqual([{ id: 'upl_1', upload_id: 'upl_1', status: 'completed' }]);
  });
  it('find_profile returns the profile, and [] when it does not exist', async () => {
    nock(API).get('/api/profiles/brand').reply(200, { id: 'p1', name: 'brand' });
    expect(await appTester(App.searches.find_profile.operation.perform, { authData, inputData: { name: 'brand' } })).toEqual([{ id: 'p1', name: 'brand' }]);
    nock(API).get('/api/profiles/none').reply(404, { error: 'Profile not found' });
    expect(await appTester(App.searches.find_profile.operation.perform, { authData, inputData: { name: 'none' } })).toEqual([]);
  });
  it('a 429 becomes a throttled error that Zapier retries later', async () => {
    nock(API).post('/api/upload_text').reply(429, { error: 'Daily limit reached for x' });
    await expect(appTester(App.creates.post_text.operation.perform, { authData, inputData: { profile: 'brand', platforms: ['x'], title: 'x' } })).rejects.toMatchObject({ name: 'ThrottledError' });
  });
  it('the API base URL can be pointed at another host', () => {
    jest.isolateModules(() => {
      process.env.POST_UPLOAD_API_BASE = 'https://api-dev.post-upload.com/';
      expect(require('../lib').baseUrl()).toBe('https://api-dev.post-upload.com');
      delete process.env.POST_UPLOAD_API_BASE;
    });
  });
});
