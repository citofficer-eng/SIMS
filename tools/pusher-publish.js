#!/usr/bin/env node
// Simple publisher script using the Pusher HTTP library.
// Usage: set env PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER then:
// node tools/pusher-publish.js channelName eventName '{"foo": "bar"}'

const Pusher = require('pusher');

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER || 'mt1';

if (!appId || !key || !secret) {
  console.error('Please set PUSHER_APP_ID, PUSHER_KEY and PUSHER_SECRET in environment');
  process.exit(1);
}

const pusher = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true
});

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node tools/pusher-publish.js <channel> <event> [jsonPayload]');
  process.exit(1);
}

const [channel, event, payload] = args;
let data = {};
if (payload) {
  try {
    data = JSON.parse(payload);
  } catch (e) {
    console.error('Failed to parse payload as JSON');
    process.exit(1);
  }
}

pusher.trigger(channel, event, data)
  .then(() => console.log('Event published'))
  .catch(err => { console.error('Publish failed', err); process.exit(1); });
