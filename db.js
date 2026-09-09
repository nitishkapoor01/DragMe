const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'dragme.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for safety and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      banner_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      location TEXT DEFAULT 'Everywhere',
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'moderator', 'admin')),
      badge TEXT DEFAULT 'Neon Pioneer',
      custom_badge TEXT DEFAULT '👑 FOUNDER',
      verified INTEGER DEFAULT 0,
      karma INTEGER DEFAULT 100,
      reputation_score INTEGER DEFAULT 0,
      cooked_ratio INTEGER DEFAULT 0,
      judgment_accuracy INTEGER DEFAULT 92,
      rank_title TEXT DEFAULT '#143 Senior Roaster',
      roast_level TEXT DEFAULT 'NOVICE ROASTER',
      hangout_hours REAL DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Run safe schema migrations for existing DB
  const userColumns = [
    { name: 'display_name', type: "TEXT DEFAULT ''" },
    { name: 'location', type: "TEXT DEFAULT 'Everywhere'" },
    { name: 'custom_badge', type: "TEXT DEFAULT '👑 FOUNDER'" },
    { name: 'verified', type: 'INTEGER DEFAULT 0' },
    { name: 'reputation_score', type: 'INTEGER DEFAULT 0' },
    { name: 'cooked_ratio', type: 'INTEGER DEFAULT 0' },
    { name: 'judgment_accuracy', type: 'INTEGER DEFAULT 92' },
    { name: 'rank_title', type: "TEXT DEFAULT '#143 Senior Roaster'" },
    { name: 'roast_level', type: "TEXT DEFAULT 'NOVICE ROASTER'" }
  ];

  for (const col of userColumns) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`);
    } catch (e) {
      // Column already exists
    }
  }

  // User Follows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);
  `);

  // 2. Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Posts table (8 rich formats supported)
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      is_anonymous INTEGER DEFAULT 0,
      anonymous_alias TEXT DEFAULT '',
      anonymous_avatar TEXT DEFAULT '',
      post_type TEXT NOT NULL CHECK(post_type IN ('confession', 'meme', 'video', 'carousel', 'text', 'poll', 'voice', 'hangout_invite')),
      title TEXT DEFAULT '',
      content TEXT NOT NULL,
      media_urls TEXT DEFAULT '[]',
      poll_options TEXT DEFAULT '[]',
      extra_data TEXT DEFAULT '{}',
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      save_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Post Likes
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 5. Post Saves (Bookmarks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 6. Post Shares
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
  `);

  // 7. Poll Votes
  db.exec(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 8. Comments & Threaded Replies
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      parent_id TEXT DEFAULT NULL,
      user_id TEXT NOT NULL,
      is_anonymous INTEGER DEFAULT 0,
      anonymous_alias TEXT DEFAULT '',
      anonymous_avatar TEXT DEFAULT '',
      content TEXT NOT NULL,
      media_url TEXT DEFAULT '',
      like_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 9. Comment Likes
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 10. Live Hangout Rooms
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT DEFAULT 'General Hangout',
      description TEXT DEFAULT '',
      owner_id TEXT NOT NULL,
      is_private INTEGER DEFAULT 0,
      passcode TEXT DEFAULT '',
      max_participants INTEGER DEFAULT 25,
      is_active INTEGER DEFAULT 1,
      participant_count INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 11. Room Members & Roles
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'moderator', 'speaker', 'member')),
      is_muted INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 12. User Views & Dwell Time (for FYP Algorithmic feed)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL,
      user_id TEXT DEFAULT '',
      ip_hash TEXT DEFAULT '',
      dwell_ms INTEGER DEFAULT 0,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
  `);

  // 13. Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sender_id TEXT DEFAULT '',
      sender_name TEXT DEFAULT '',
      sender_avatar TEXT DEFAULT '',
      type TEXT NOT NULL,
      target_id TEXT DEFAULT '',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 14. Reports & Moderation
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment', 'user', 'room')),
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 15. Moderation Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS moderation_logs (
      id TEXT PRIMARY KEY,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_is_anon ON posts(is_anonymous);
    CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_poll_votes_post_id ON poll_votes(post_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON rooms(is_active);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_views_post_user ON user_views(post_id, user_id);
  `);

  try {
    db.prepare(`
      UPDATE users 
      SET display_name = CASE WHEN display_name IS NULL OR display_name = '' THEN 'DragMe Official' ELSE display_name END,
          verified = 1,
          custom_badge = '👑 FOUNDER',
          badge = 'Senior Roaster',
          bio = CASE WHEN bio IS NULL OR bio = '' THEN '👑 Official DragMe Founder & Product Team. Building the rawest space on the internet — no filters, just fire. Roadmap, live feature polls & platform updates.' ELSE bio END,
          location = CASE WHEN location IS NULL OR location = '' THEN 'Everywhere' ELSE location END
      WHERE id = 'usr_admin_01'
    `).run();
  } catch (e) {}

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('⚡ Seeding initial DragMe users, rich posts, and hangout rooms...');

  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, avatar_url, banner_url, bio, role, badge, karma, hangout_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'usr_admin_01',
    'DragMeMaster',
    'admin@dragme.app',
    passwordHash,
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80',
    'System Architect & Supreme Overseer of DragMe. Keeping the dual-identity realm balanced.',
    'admin',
    'Cyber Overseer',
    9999,
    142.5
  );

  insertUser.run(
    'usr_mod_01',
    'ValkyrieGuard',
    'mod@dragme.app',
    passwordHash,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&auto=format&fit=crop&q=80',
    'Community Warden & Safe Space Sentinel. Unfiltered expression with zero harassment.',
    'moderator',
    'Sentinel Shield',
    3450,
    68.2
  );

  insertUser.run(
    'usr_alice_01',
    'AuraGamer',
    'alice@dragme.app',
    passwordHash,
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
    'Synthwave producer, late night coder, and digital drifter. Living between shadows and stage lights.',
    'user',
    'Audio Alchemist',
    1820,
    45.8
  );

  insertUser.run(
    'usr_bob_01',
    'CyberKitsune',
    'bob@dragme.app',
    passwordHash,
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
    'Vibe enthusiast, philosophy buff, and meme collector.',
    'user',
    'Neon Pioneer',
    890,
    22.4
  );

  // 8 Rich Post Formats Seed
  const insertPost = db.prepare(`
    INSERT INTO posts (id, user_id, is_anonymous, anonymous_alias, anonymous_avatar, post_type, title, content, media_urls, poll_options, extra_data, like_count, comment_count, save_count, share_count, view_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  // 1. Anonymous Confession
  insertPost.run(
    'post_confession_01',
    'usr_alice_01',
    1,
    'Phantom Whisper #714',
    'neon_ghost_purple',
    'confession',
    'Late Night Confession',
    'I tell all my colleagues and LinkedIn connections that I love working 70-hour weeks in tech, but the truth is I secretly spend half my workday listening to lofi beats in dark rooms and building synthwave tracks for strangers on DragMe.',
    '[]',
    '[]',
    JSON.stringify({ sentiment: 'Raw Truth', glow_color: '#fe0879' }),
    142,
    18,
    35,
    9,
    1250,
    '-10 minutes'
  );

  // 2. Meme Post
  insertPost.run(
    'post_meme_01',
    'usr_bob_01',
    0,
    '',
    '',
    'meme',
    'Every Single Code Review',
    'When you submit 1,500 lines of code without tests vs 1 line change with 40 tests.',
    JSON.stringify(['https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80']),
    '[]',
    JSON.stringify({ meme_template: 'Classic Dev' }),
    98,
    12,
    22,
    15,
    890,
    '-25 minutes'
  );

  // 3. Interactive Poll / Debate Post
  insertPost.run(
    'post_poll_01',
    'usr_mod_01',
    0,
    '',
    '',
    'poll',
    'Community Debate: Human Socials vs AI Agents',
    'Will social media in 2030 be primarily human-to-human connection or AI-personalized companion feeds?',
    '[]',
    JSON.stringify([
      { id: 0, text: 'Pure Human Authentic Spaces (DragMe Style)', votes: 156 },
      { id: 1, text: 'Hybrid Human + Synthetic AI Swarms', votes: 84 },
      { id: 2, text: 'Total AI Companion Hegemony', votes: 19 }
    ]),
    JSON.stringify({ total_votes: 259 }),
    210,
    34,
    48,
    27,
    1920,
    '-45 minutes'
  );

  // 4. Voice Snippet Post
  insertPost.run(
    'post_voice_01',
    'usr_alice_01',
    0,
    '',
    '',
    'voice',
    'Midnight Synthwave Melody Snippet',
    'Recorded this melodic progression with my analog Juno synth at 3 AM. Turn your bass up and tell me what vibes this gives you.',
    JSON.stringify(['https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg']),
    '[]',
    JSON.stringify({ duration: 42, waveform: [15, 30, 45, 80, 95, 60, 40, 75, 90, 100, 85, 70, 45, 60, 80, 50, 30, 20] }),
    188,
    29,
    64,
    18,
    1450,
    '-2 hours'
  );

  // 5. Multi-Image Carousel Post
  insertPost.run(
    'post_carousel_01',
    'usr_admin_01',
    0,
    '',
    '',
    'carousel',
    'Cyberpunk Cityscapes: Tokyo & Neo-Seoul Nights',
    'A gallery of high-shutter atmospheric shots captured during our midnight photowalk. Which frame is your favorite wallpaper?',
    JSON.stringify([
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=900&auto=format&fit=crop&q=80'
    ]),
    '[]',
    JSON.stringify({ slide_count: 3 }),
    265,
    41,
    92,
    38,
    2890,
    '-3 hours'
  );

  // 6. Deep Thought / Text Post
  insertPost.run(
    'post_text_01',
    'usr_bob_01',
    0,
    '',
    '',
    'text',
    'The Illusion of Digital Permanence',
    'We spend our lives curating identities on platforms that could disappear in a single database drop. DragMe reminds me that the best conversations happen when you shed the ego of your follower count and just talk into the neon void.',
    '[]',
    '[]',
    JSON.stringify({ gradient_style: 'cyber_dusk' }),
    174,
    22,
    51,
    14,
    1320,
    '-5 hours'
  );

  // 7. Video Post
  insertPost.run(
    'post_video_01',
    'usr_alice_01',
    0,
    '',
    '',
    'video',
    'Audio Visualizer Shader Loop (GLSL)',
    'Live rendering interactive audio-reactive particles running on WebGL2 in 60fps.',
    JSON.stringify(['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4']),
    '[]',
    JSON.stringify({ aspect_ratio: '16:9', duration: 15 }),
    312,
    49,
    110,
    56,
    3420,
    '-7 hours'
  );

  // 8. Hangout Invite Post
  insertPost.run(
    'post_hangout_01',
    'usr_admin_01',
    0,
    '',
    '',
    'hangout_invite',
    '⚡ LIVE ROOM: Midnight Philosophy & Cyber Lounge',
    'Join our open voice & chat lounge right now. Topics: Decentralized networks, privacy in 2026, and synth music.',
    '[]',
    '[]',
    JSON.stringify({
      room_id: 'room_midnight_01',
      room_title: 'Midnight Philosophy & Cyber Lounge',
      participant_count: 8,
      is_live: true
    }),
    240,
    38,
    45,
    30,
    2100,
    '-30 minutes'
  );

  // Seed Live Hangout Rooms
  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, title, topic, description, owner_id, is_private, passcode, max_participants, is_active, participant_count, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRoom.run(
    'room_midnight_01',
    'Midnight Philosophy & Cyber Lounge',
    'Philosophy & Cyberpunk',
    'Open voice & chat discussion on modern digital identity, privacy, and late-night vibes.',
    'usr_admin_01',
    0,
    '',
    25,
    1,
    8,
    JSON.stringify(['Voice', 'Chill', 'Philosophy', 'Cyber'])
  );

  insertRoom.run(
    'room_lofi_02',
    'Lofi Beats & Chill Coding',
    'Music & Coding Hangout',
    'Co-working room with continuous synth beats. Muted mics preferred, active text chat.',
    'usr_alice_01',
    0,
    '',
    50,
    1,
    14,
    JSON.stringify(['Co-Working', 'Music', 'No-Pressure'])
  );

  insertRoom.run(
    'room_confessions_03',
    'Anonymous Voice Masked Confessions',
    'Unfiltered Ghost Lounge',
    'Pitch-shifted live voice & masked chat. Zero names, pure vulnerability.',
    'usr_mod_01',
    0,
    '',
    20,
    1,
    11,
    JSON.stringify(['Anonymous', 'Masked', 'Confessions'])
  );

  // Seed Comments
  const insertComment = db.prepare(`
    INSERT INTO comments (id, post_id, parent_id, user_id, is_anonymous, anonymous_alias, anonymous_avatar, content, media_url, like_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertComment.run(
    'cmt_01',
    'post_confession_01',
    null,
    'usr_bob_01',
    1,
    'Cyber Spectre #302',
    'neon_ghost_cyan',
    'Honestly, this is 90% of engineers in our generation. Corporate performance on the outside, creative night-owl on the inside. You are not alone.',
    '',
    24,
    '-8 minutes'
  );

  insertComment.run(
    'cmt_02',
    'post_confession_01',
    'cmt_01',
    'usr_alice_01',
    1,
    'Phantom Whisper #714',
    'neon_ghost_purple',
    'Thank you so much. It feels so liberating to say it out loud without fear of corporate blowback.',
    '',
    12,
    '-5 minutes'
  );

  console.log('✅ Database successfully initialized and seeded with rich dual-identity content.');
}

initDatabase();

module.exports = {
  db,
  initDatabase
};
