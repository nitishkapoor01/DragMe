const http = require('http');
const assert = require('assert');
const { app, server } = require('../server');
const { db } = require('../db');

const TEST_PORT = 3001;

function runTest(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      return true;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      return false;
    }
  };
}

async function request(path, options = {}) {
  const url = `http://localhost:${TEST_PORT}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING DRAGME COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // Start test server
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  let totalPassed = 0;
  let totalFailed = 0;

  let testUserToken = '';
  let testUserId = '';
  let adminToken = '';
  let samplePostId = '';
  let samplePollId = '';

  const tests = [
    // 1. Auth & RBAC Tests
    runTest('Register New User with Validation', async () => {
      const username = `TestCyber_${Date.now().toString().slice(-4)}`;
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email: `${username.toLowerCase()}@dragme.test`,
          password: 'Password123!'
        })
      });
      assert.strictEqual(res.status, 201, 'Registration should return 201 Created');
      assert.ok(res.data.token, 'Token must be returned on registration');
      assert.strictEqual(res.data.user.username, username);
      testUserToken = res.data.token;
      testUserId = res.data.user.id;
    }),

    runTest('Login with Seed Admin Account', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          login: 'DragMeMaster',
          password: 'Password123!'
        })
      });
      assert.strictEqual(res.status, 200, 'Admin login should succeed');
      assert.strictEqual(res.data.user.role, 'admin');
      adminToken = res.data.token;
    }),

    runTest('Unauthenticated Guest Feed Access (Allowed)', async () => {
      const res = await request('/api/posts?limit=5');
      assert.strictEqual(res.status, 200, 'Guests can view posts');
      assert.ok(Array.isArray(res.data.posts), 'Posts should be an array');
    }),

    runTest('Unauthenticated Post Creation Blocked (401)', async () => {
      const res = await request('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content: 'I should be rejected' })
      });
      assert.strictEqual(res.status, 401, 'Unauthenticated posting must return 401');
    }),

    // 2. Zero Identity Leak Privacy Tests
    runTest('ZERO Identity Leak: Anonymous Confession Payload Sanitization', async () => {
      // Create anonymous confession
      const res = await request('/api/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({
          post_type: 'confession',
          content: 'Secret anonymous confession with zero leak guarantee.',
          is_anonymous: true
        })
      });

      assert.strictEqual(res.status, 201, 'Confession should be created');
      const post = res.data.post;
      samplePostId = post.id;

      // CRITICAL PRIVACY CHECKS:
      assert.strictEqual(post.is_anonymous, true, 'is_anonymous must be true');
      assert.strictEqual(post.user_id, null, 'Real user_id MUST NEVER be returned in post object');
      assert.ok(!post.author.id, 'Author ID must be hidden');
      assert.ok(post.author.username.includes('#'), 'Author username must be an anonymous masked alias');
      assert.strictEqual(post.author.is_anonymous, true);
    }),

    runTest('ZERO Identity Leak: Anonymous Comment Payload Sanitization', async () => {
      const res = await request(`/api/posts/${samplePostId}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({
          content: 'Anonymous reply echo',
          is_anonymous: true
        })
      });

      assert.strictEqual(res.status, 201, 'Comment should be created');
      const comment = res.data.comment;

      // Privacy checks on comment:
      assert.strictEqual(comment.is_anonymous, true);
      assert.strictEqual(comment.user_id, null, 'Real user_id must be null on anonymous comment');
      assert.ok(!comment.author.id, 'Author ID must be absent');
      assert.ok(comment.author.username.includes('#') || comment.author.username.includes('Ghost') || comment.author.username.includes('Whisperer'));
    }),

    // 3. 8 Rich Post Formats Creation
    runTest('Create and Verify Interactive Poll Format', async () => {
      const res = await request('/api/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({
          post_type: 'poll',
          title: 'Test Poll: Favorite Neon Color?',
          content: 'Vote for your aesthetic:',
          poll_options: ['Cyber Lime', 'Neon Magenta', 'Electric Cyan'],
          is_anonymous: false
        })
      });

      assert.strictEqual(res.status, 201, 'Poll post created');
      assert.strictEqual(res.data.post.post_type, 'poll');
      assert.strictEqual(res.data.post.poll_options.length, 3);
      samplePollId = res.data.post.id;
    }),

    runTest('Single-Vote Poll Enforcement & Duplicate Rejection (409)', async () => {
      // Vote Option 0
      const vote1 = await request(`/api/posts/${samplePollId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({ option_index: 0 })
      });
      assert.strictEqual(vote1.status, 200, 'First vote accepted');
      assert.strictEqual(vote1.data.user_vote, 0);

      // Attempt duplicate vote
      const vote2 = await request(`/api/posts/${samplePollId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({ option_index: 1 })
      });
      assert.strictEqual(vote2.status, 409, 'Duplicate poll vote must be rejected with 409 Conflict');
    }),

    // 4. Atomic Interactions (Like / Unlike)
    runTest('Atomic Like & Unlike Counter Integrity', async () => {
      // Like
      const likeRes = await request(`/api/posts/${samplePostId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` }
      });
      assert.strictEqual(likeRes.status, 200);
      assert.strictEqual(likeRes.data.liked, true);
      const countAfterLike = likeRes.data.like_count;

      // Unlike
      const unlikeRes = await request(`/api/posts/${samplePostId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` }
      });
      assert.strictEqual(unlikeRes.status, 200);
      assert.strictEqual(unlikeRes.data.liked, false);
      assert.strictEqual(unlikeRes.data.like_count, countAfterLike - 1, 'Unlike must decrement counter atomically');
    }),

    // 5. Live Hangout Rooms
    runTest('Live Hangout Room Creation & Discovery', async () => {
      const res = await request('/api/rooms', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({
          title: 'Automated Test Voice Lounge',
          topic: 'Testing & QA',
          max_participants: 20
        })
      });

      assert.strictEqual(res.status, 201, 'Hangout room created');
      assert.ok(res.data.roomId);

      // Verify discovery
      const listRes = await request('/api/rooms');
      assert.strictEqual(listRes.status, 200);
      const found = listRes.data.rooms.find(r => r.id === res.data.roomId);
      assert.ok(found, 'Created room must appear in active rooms list');
    }),

    // 6. FYP Velocity & Dwell Time Logging
    runTest('Dwell-Time View Logging API', async () => {
      const res = await request(`/api/posts/${samplePostId}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({ dwell_ms: 4500 })
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
    }),

    // 7. Security: Input Sanitization & XSS Protection
    runTest('Input Sanitization & XSS Injection Stripping', async () => {
      const xssContent = '<script>alert("hacked")</script><b>Hello Cyber</b>';
      const res = await request('/api/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testUserToken}` },
        body: JSON.stringify({
          post_type: 'text',
          content: xssContent
        })
      });

      assert.strictEqual(res.status, 201);
      assert.ok(!res.data.post.content.includes('<script>'), 'Dangerous script tags must be escaped/sanitized');
    }),

    // 8. Admin Telemetry & Authorization
    runTest('Admin Dashboard Access & Telemetry Stats', async () => {
      // Non-admin forbidden (403)
      const nonAdminRes = await request('/api/admin/stats', {
        headers: { Authorization: `Bearer ${testUserToken}` }
      });
      assert.strictEqual(nonAdminRes.status, 403, 'Regular user cannot access admin stats');

      // Admin access allowed (200)
      const adminRes = await request('/api/admin/stats', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(adminRes.status, 200);
      assert.ok(adminRes.data.stats.users_total >= 1);
      assert.ok(adminRes.data.stats.posts_total >= 1);
    })
  ];

  for (const testFn of tests) {
    const passed = await testFn();
    if (passed) totalPassed++;
    else totalFailed++;
  }

  console.log('\n------------------------------------------------------');
  console.log(`📊 TEST SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed out of ${tests.length} Total Tests`);
  console.log('------------------------------------------------------\n');

  // Close server
  server.close();

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
