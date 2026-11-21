'use strict';
const crypto = require('crypto');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
const API = 'https://api.post-upload.com';
const authData = { api_key: 'test-key' };

afterEach(() => nock.cleanAll());

describe('authentication', () => {
  it('tests the key against /api/me and sends it as Apikey', async () => {
    nock(API, { reqheaders: { authorization: 'Apikey test-key' } }).get('/api/me').reply(200, { email: 'a@b.test', plan: 'advanced' });
    const res = await appTester(App.authentication.test, { authData });
    expect(res.email).toBe('a@b.test');
  });
  it('turns a 401 into a clear message', async () => {
    nock(API).get('/api/me').reply(401, { error: 'Invalid API key' });
    await expect(appTester(App.authentication.test, { authData })).rejects.toThrow(/Invalid API key. Check your Post-Upload API key/);
  });
});

describe('creates', () => {
  it('Post Text sends JSON with platforms, options and the reference', async () => {
    let sent;
    nock(API).post('/api/upload_text', (b) => { sent = b; return true; }).reply(201, { success: true, data: { upload_id: 'upl_1' } });
    const res = await appTester(App.creates.post_text.operation.perform, {
      authData,
      inputData: { profile: 'brand', platforms: ['linkedin', 'x'], title: 'Hello', description: '', schedule: '', reference: 'row-7', platform_options: { reddit_subreddit: '' }, add_to_queue: 'no' },
    });
    expect(res.data.upload_id).toBe('upl_1');
    expect(sent).toEqual({ user: 'brand', title: 'Hello', platforms: ['linkedin', 'x'], async_upload: true, request_id: 'row-7' });
  });
  it('Upload Video passes the file as video_url', async () => {
    let sent;
    nock(API).post('/api/upload', (b) => { sent = b; return true; }).reply(201, { success: true, data: { upload_id: 'upl_2' } });
    await appTester(App.creates.upload_video.operation.perform, {
      authData,
      inputData: { profile: 'brand', platforms: ['youtube'], title: 'Clip', video: 'https://files.test/clip.mp4', platform_options: { youtube_privacy: 'unlisted' } },
    });
    expect(sent).toMatchObject({ video_url: 'https://files.test/clip.mp4', youtube_privacy: 'unlisted', platforms: ['youtube'] });
  });
  it('Upload Photos sends photo_urls', async () => {
    let sent;
    nock(API).post('/api/upload_photos', (b) => { sent = b; return true; }).reply(201, { success: true });
    await appTester(App.creates.upload_photos.operation.perform, { authData, inputData: { profile: 'brand', platforms: ['instagram'], title: 'Set', photos: ['https://f.test/a.jpg', 'https://f.test/b.jpg'] } });
    expect(sent.photo_urls).toEqual(['https://f.test/a.jpg', 'https://f.test/b.jpg']);
  });
  it('shows the API error message and code', async () => {
    nock(API).post('/api/upload_text').reply(400, { error: 'Platform(s) not connected: bluesky. Connect them in the dashboard first.', error_code: 'PLATFORM_NOT_CONNECTED' });
    await expect(appTester(App.creates.post_text.operation.perform, { authData, inputData: { profile: 'brand', platforms: ['bluesky'], title: 'x' } })).rejects.toThrow(/Platform\(s\) not connected: bluesky/);
  });
  it('Edit Scheduled Post PATCHes only the fields that are set', async () => {
    let sent;
    nock(API).patch('/api/schedule/upl_9', (b) => { sent = b; return true; }).reply(200, { success: true });
    await appTester(App.creates.edit_scheduled_post.operation.perform, { authData, inputData: { job_id: 'upl_9', scheduled_date: '2026-12-01T09:30:00Z', title: '', caption: '' } });
    expect(sent).toEqual({ scheduled_date: '2026-12-01T09:30:00Z' });
  });
});

describe('upload triggers', () => {
  const t = App.triggers.upload_failed.operation;

  it('subscribes with its event, profile and source, and stores id + secret', async () => {
    let sent;
    nock(API).post('/api/webhooks/subscriptions', (b) => { sent = b; return true; }).reply(201, { subscription: { id: 'whs_1' }, secret: 's3cret' });
    const res = await appTester(t.performSubscribe, { authData, targetUrl: 'https://hooks.zapier.test/abc', inputData: { profile: 'brand' } });
    expect(sent).toMatchObject({ url: 'https://hooks.zapier.test/abc', events: ['upload.failed'], profile: 'brand', source: 'zapier' });
    expect(res).toEqual({ id: 'whs_1', secret: 's3cret' });
  });

  it('unsubscribes, and a subscription that is already gone is fine', async () => {
    nock(API).delete('/api/webhooks/subscriptions/whs_1').reply(404, { error: 'Subscription not found' });
    await expect(appTester(t.performUnsubscribe, { authData, subscribeData: { id: 'whs_1' } })).resolves.toEqual({});
  });

  it('accepts a correctly signed event and rejects a forged one', async () => {
    const payload = { event: 'upload.failed', upload_id: 'upl_5', data: { profile: 'brand' } };
    const raw = JSON.stringify(payload);
    const sig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(raw).digest('hex');
    const good = await appTester(t.perform, { cleanedRequest: payload, rawRequest: { content: raw, headers: { 'Http-X-Post-Upload-Signature': sig } }, subscribeData: { secret: 's3cret' } });
    expect(good).toEqual([{ id: 'upl_5:upload.failed', ...payload }]);
    const forged = await appTester(t.perform, { cleanedRequest: payload, rawRequest: { content: raw, headers: { 'Http-X-Post-Upload-Signature': 'sha256=00' } }, subscribeData: { secret: 's3cret' } });
    expect(forged).toEqual([]);
  });

  it('performList builds samples from recent failed uploads', async () => {
    nock(API).get('/api/uploads').query({ status: 'failed', limit: 25 }).reply(200, { uploads: [{ id: 'upl_7', title: 'T', status: 'failed', profile_name: 'brand', platforms: ['x'], platform_statuses: { x: 'failed' } }] });
    const res = await appTester(t.performList, { authData, inputData: {} });
    expect(res[0]).toMatchObject({ id: 'upl_7:upload.failed', event: 'upload.failed', data: { profile: 'brand' } });
  });
});

describe('searches', () => {
  it('Find Upload returns [] for an unknown ID', async () => {
    nock(API).get('/api/uploadposts/status').query({ request_id: 'nope' }).reply(404, { error: 'Upload not found' });
    expect(await appTester(App.searches.find_upload.operation.perform, { authData, inputData: { request_id: 'nope' } })).toEqual([]);
  });
});
