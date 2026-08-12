# LOCKIN — Build the Social Feed (Posts System)
# Full Antigravity Implementation Prompt

---

## Project Context

LOCKIN is a mobile-first student productivity web app. Users complete focus sessions called "missions" and receive a RecapCard. We are building a social feed where users can post their session recaps as square post cards, with reactions and comments.

Tech stack:
- Frontend: Next.js 15 (App Router), React 19, Tailwind CSS, Framer Motion, Lucide React
- Backend: Node.js + Express, Prisma ORM
- Database: PostgreSQL (Supabase)

The existing RecapCard component (LockinRecapCard.tsx) already renders a full visual card with tier colors, stats, flip animation, and export. DO NOT modify RecapCard.tsx under any circumstances.

The old social/discovery section was called "Discover". Rename ALL references to "Feed" — nav labels, route names (/discover → /feed), page titles, component file names if needed.

---

## Color Scheme (Strict — Apply Everywhere)

- Primary accent: #8B0000 (cherry red / dark crimson)
- Hover/active accent: #A00000
- Background: #000000 or zinc-950 (#0a0a0a)
- Surface cards/inputs: zinc-900 (#18181b)
- Border default: white/[0.06] or white/10
- Text primary: #FFFFFF
- Text secondary: zinc-500 (#71717a)
- Active state (selected tab, active pill, primary button): bg-[#8B0000] text-white
- Avatar circle: bg-zinc-900 border border-[#8B0000]/40 text-[#8B0000] font-black
- Do NOT use the gold/silver/bronze tier color system from RecapCard anywhere in the feed UI. All accents use #8B0000 only.

---

## Emoji Rules (Strict)

- ZERO decorative emojis anywhere in the UI — no emojis in labels, empty states, toasts, headers, tab names, meta rows, or anywhere else
- Reactions are the ONLY place emojis appear. Only these four are allowed: 🔥 💀 ❤️ 🧠
- Comments icon: use Lucide `MessageSquare` icon — NOT a 💬 emoji
- Visibility selector: use Lucide icons (Users, UserCheck, Globe) — NOT emoji
- Toast messages: text only, no emoji
- Empty states: text only, no emoji
- Button labels: text only, no emoji

---

## Typography & Style Rules

- Font weight: font-black for ALL labels, headings, stat values, button text, tab names
- Font weight: font-bold for body text, captions, comment text
- Uppercase tracking: use uppercase + tracking-widest for section headers and labels
- Borders: border-white/[0.06] default, border-white/10 for inputs on focus
- Border radius: rounded-2xl for cards, rounded-xl for inputs and buttons, rounded-full for avatar circles and reaction pills
- No box shadows except subtle ring on focused inputs (ring-1 ring-[#8B0000]/50)
- Animations: Framer Motion for all sheet/modal enter/exit transitions only. Keep it minimal — no gratuitous animation.
- Reaction count pop on toggle: scale 1 → 1.3 → 1, duration 150ms

---

## 1. Database — schema.prisma additions

Add these three models:

```prisma
model Post {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  recapId     Int?      @map("recap_id")
  imageUrl    String?   @map("image_url") @db.Text
  caption     String?   @db.VarChar(300)
  visibility  String    @default("college") @db.VarChar(20)
  createdAt   DateTime  @default(now()) @map("created_at")

  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  recap       SessionRecap?  @relation(fields: [recapId], references: [id], onDelete: SetNull)
  comments    Comment[]
  reactions   Reaction[]

  @@index([userId, createdAt])
  @@map("post")
}

model Comment {
  id        Int      @id @default(autoincrement())
  postId    Int      @map("post_id")
  userId    Int      @map("user_id")
  text      String   @db.VarChar(300)
  createdAt DateTime @default(now()) @map("created_at")

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("comment")
}

model Reaction {
  id        Int      @id @default(autoincrement())
  postId    Int      @map("post_id")
  userId    Int      @map("user_id")
  emoji     String   @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, postId, emoji])
  @@map("reaction")
}
```

Also add to the existing User model:
```prisma
posts     Post[]
comments  Comment[]
reactions Reaction[]
```

Also add to the existing SessionRecap model:
```prisma
posts     Post[]
```

Run after: `npx prisma migrate dev --name add_posts_feed`

---

## 2. Backend — src/controllers/postController.js

Create this file. Wrap all DB calls with try/catch. Use the existing `isDbUnavailable` util from `../utils/dbFallback` for DB error handling.

### POST /api/posts
Body: `{ userId, recapId?, imageUrl?, caption, visibility }`
- Validate visibility is one of: "college", "followers", "everyone". Default "college".
- Validate caption max 300 chars if provided.
- Insert into Post table.
- Return created post with user (id, name, department, college, reputationScore) included.

### GET /api/posts/feed
Query params: `userId` (required), `filter` ("college"|"followers"|"everyone", default "college"), `limit` (default 20), `cursor` (optional, post id for pagination)

Filter logic:
- "college": posts from users with same collegeId as requesting user (join through User.collegeId)
- "followers": posts from users the requesting user follows (via Follow table) + themselves
- "everyone": all posts, no filter

Each post in response must include:
- user: { id, name, department, college, reputationScore }
- recap: { sessionDuration, tasksCompleted, streak, missionRank, categorySnapshot, missionTitle, metadata, shareId } — nullable if recapId is null
- reactionCounts: object grouped by emoji e.g. { "🔥": 12, "💀": 4, "❤️": 7, "🧠": 2 }
- commentCount: integer
- userReactions: array of emoji strings the requesting userId has already reacted with

Cursor pagination: order by post.id desc. If cursor provided, skip 1 and start from that id. Return `{ posts, nextCursor }` where nextCursor is last post's id or null.

### GET /api/posts/:id
Single post with:
- Full user info (id, name, department, college, reputationScore)
- Full recap info (same fields as feed)
- All comments ordered by createdAt asc, each with user (id, name, department)
- reactionCounts grouped by emoji
- userReactions for the requesting userId (pass as query param ?userId=)

### POST /api/posts/:id/react
Body: `{ userId, emoji }`
- Validate emoji is one of: 🔥 💀 ❤️ 🧠
- Toggle: if reaction exists for this userId + postId + emoji, delete it. If not, create it.
- Return updated reactionCounts for the post (object grouped by emoji with counts) and userReactions array for this user.

### POST /api/posts/:id/comments
Body: `{ userId, text }`
- Validate text max 300 chars, not empty.
- Insert Comment.
- Return created comment with user (id, name, department).

### DELETE /api/posts/:id
Body: `{ userId }`
- Verify post.userId === userId. If not, return 403.
- Delete post (cascade handles comments and reactions).
- Return 204.

Export: `{ createPost, getFeedPosts, getPost, reactToPost, addComment, deletePost }`

---

## 3. Backend — src/routes/posts.js

```js
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  createPost,
  getFeedPosts,
  getPost,
  reactToPost,
  addComment,
  deletePost
} = require("../controllers/postController");

const router = express.Router();

router.get("/feed", asyncHandler(getFeedPosts));
router.post("/", asyncHandler(createPost));
router.get("/:id", asyncHandler(getPost));
router.post("/:id/react", asyncHandler(reactToPost));
router.post("/:id/comments", asyncHandler(addComment));
router.delete("/:id", asyncHandler(deletePost));

module.exports = router;
```

Mount in server.js: `app.use("/api/posts", postsRouter);`

---

## 4. Backend — recapController.js modification

In the `finishSession` function, find Step 11 (the existing FeedItem creation block).
Keep the FeedItem creation exactly as-is.
Immediately AFTER it, add:

```js
// Auto-create a feed post if session is public
if (recap.isPublic) {
  await prisma.post.create({
    data: {
      userId: numericUserId,
      recapId: recap.id,
      caption: reflection?.reflectionText || null,
      visibility: "college",
      imageUrl: reflection?.screenshot || null,
    }
  });
}
```

---

## 5. Frontend — components/ShareToFeedSheet.tsx

A bottom sheet that slides up from the bottom of the screen. It is triggered from the RecapCard action row — add a new "POST TO FEED" button in the action row of LockinRecapCard.tsx (only shown on non-failed sessions, alongside the existing Export and Share buttons). This button sets a state that opens ShareToFeedSheet.

Props:
```ts
interface ShareToFeedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recapData: {
    id: number;
    shareId: string;
    sessionDuration: number;
    tasksCompleted: number;
    streak: number;
    missionTitle: string;
    categorySnapshot: string;
    missionRank: number;
  };
  userId: number;
  onPosted: () => void;
}
```

Layout and design:
- Backdrop: fixed inset-0 bg-black/70 backdrop-blur-sm z-[998], click to close
- Sheet: fixed bottom-0 left-0 right-0 z-[999] bg-zinc-950 border-t border-white/[0.06] rounded-t-3xl px-5 pt-5 pb-8
- Framer Motion: initial y: "100%", animate y: 0, exit y: "100%", transition spring stiffness 300 damping 30
- Drag handle: centered 40px wide 4px tall bg-zinc-800 rounded-full mb-5

Sheet contents top to bottom:

**Header:**
- "POST TO FEED" — text-sm font-black uppercase tracking-widest text-white
- "Share your session with your college" — text-xs text-zinc-500 mt-1

**Compact recap preview strip** (not the full RecapCard):
- bg-zinc-900 rounded-xl p-3 mt-4 flex items-center gap-3
- Left: small 8px circle bg-[#8B0000] (accent dot)
- Center: mission title (font-bold text-sm text-white truncate), below it: duration + tasks in text-xs text-zinc-500 e.g. "45m · 4 tasks · 3 day streak"
- Right: nothing

**Caption input:**
- Label: "CAPTION" text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-4 mb-1.5
- textarea: w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-[#8B0000]/50
- Character counter: right-aligned text-[10px] text-zinc-600, shows "X/300"

**Image upload:**
- Label: "ATTACH IMAGE" text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-4 mb-1.5
- If no image: dashed border box border-2 border-dashed border-white/10 rounded-xl h-24 flex items-center justify-center gap-2 cursor-pointer hover:border-[#8B0000]/40 transition
  - Lucide `ImagePlus` icon size 16 text-zinc-600
  - "Add screenshot" text-xs text-zinc-600
  - Hidden file input, accept="image/*"
- If image selected: show thumbnail aspect-video rounded-xl object-cover relative, with X button top-right to remove (Lucide X icon, size 14, bg-black/60 rounded-full p-0.5)

**Visibility selector:**
- Label: "VISIBLE TO" text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-4 mb-1.5
- 3 pills in a row, gap-2:
  - "COLLEGE" with Lucide `Users` icon size 12
  - "FOLLOWERS" with Lucide `UserCheck` icon size 12
  - "EVERYONE" with Lucide `Globe` icon size 12
- Each pill: text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border flex items-center gap-1.5
- Active: bg-[#8B0000] text-white border-[#8B0000]
- Inactive: bg-transparent text-zinc-500 border-white/10 hover:border-white/20

**Action buttons:**
- "POST IT" button: w-full mt-5 bg-[#8B0000] hover:bg-[#A00000] text-white font-black uppercase tracking-widest text-sm rounded-xl py-3 transition. Shows spinner (Lucide `Loader2` animate-spin size 14) while posting.
- "Skip" below it: w-full text-center text-xs text-zinc-600 hover:text-zinc-400 mt-3 cursor-pointer font-bold uppercase tracking-wider

On POST IT click:
1. If imageUrl is provided, upload the image file to Supabase Storage bucket "post-images" using the supabase client. Get back the public URL.
2. Call POST /api/posts with: { userId, recapId: recapData.id, caption, imageUrl: uploadedUrl or null, visibility }
3. On success: close sheet, call onPosted(), show a toast "Posted to your feed" (text only, no emoji) using whatever toast library is already in the project
4. On error: show error toast "Failed to post. Try again."

---

## 6. Frontend — components/FeedPostCard.tsx

Square-ish post card. This is the main feed unit.

Props:
```ts
interface FeedPostCardProps {
  post: {
    id: number;
    userId: number;
    caption: string | null;
    imageUrl: string | null;
    visibility: string;
    createdAt: string;
    user: {
      id: number;
      name: string;
      department: string | null;
      college: string | null;
      reputationScore: number;
    };
    recap: {
      sessionDuration: number;
      tasksCompleted: number;
      streak: number;
      missionRank: number;
      categorySnapshot: string;
      missionTitle: string;
      shareId: string;
      metadata?: any;
    } | null;
    reactionCounts: Record<string, number>;
    commentCount: number;
    userReactions: string[];
  };
  currentUserId: number;
  onReact: (postId: number, emoji: string) => void;
  onViewPost: (postId: number) => void;
}
```

Card layout — full structure:

```
bg-zinc-950 border border-white/[0.06] rounded-2xl overflow-hidden w-full
```

**User row** (px-4 pt-4 pb-3):
- Avatar: w-8 h-8 rounded-full bg-zinc-900 border border-[#8B0000]/40 flex items-center justify-center text-[10px] font-black text-[#8B0000] — show first 2 initials of name
- Name: text-sm font-black text-white
- Department: text-xs text-zinc-500 (e.g. "CSE · 3rd Year" or just department string)
- Timestamp: text-[10px] text-zinc-600 — relative time (e.g. "2h ago", use a simple helper function)
- Visibility icon: Lucide Users/UserCheck/Globe size 10 text-zinc-600, shown after timestamp with a dot separator

**Image** (if imageUrl exists):
- w-full aspect-[4/3] object-cover — no border radius, flush with card edges
- Render directly below user row, no padding

**Stat card** (always shown, mx-4 mt-3 if no image, mt-0 if image exists — add mt-3 in that case too):
- bg-zinc-900 rounded-xl p-3
- Top row: mission title truncated, font-bold text-sm text-white
- Second row: category in text-[10px] uppercase font-black text-[#8B0000] tracking-wider
- Third row: stats in text-xs text-zinc-400 font-bold — format: "[duration] · [tasks] tasks · [streak]d streak · Rank #[rank]"
  - Duration: show "Xh Ym" if hours > 0, else "Ym"

**Caption** (if exists, px-4 mt-3):
- text-sm font-bold text-zinc-300 leading-relaxed

**Reactions row** (px-4 mt-3 pb-4):
- Left side: reaction buttons in a row gap-2
  - For each of the 4 emojis [🔥, 💀, ❤️, 🧠]:
    - pill button: flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border transition
    - If user has reacted with this emoji: bg-[#8B0000]/15 border-[#8B0000]/40 text-white
    - If not reacted: bg-transparent border-white/10 text-zinc-500 hover:border-white/20
    - Show emoji + count (show 0 if no reactions for that emoji)
    - On click: call onReact(post.id, emoji), animate count with Framer Motion scale pop
- Right side: ml-auto flex items-center gap-1 text-xs text-zinc-500 font-bold cursor-pointer hover:text-white transition, onClick calls onViewPost(post.id)
  - Lucide MessageSquare icon size 13
  - "[commentCount] comments" or "0 comments"

---

## 7. Frontend — components/PostDetailModal.tsx

Full-screen modal (mobile-style).

Props:
```ts
interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number | null;
  currentUserId: number;
}
```

Behavior:
- Fetch GET /api/posts/:id?userId=currentUserId when postId changes and isOpen is true
- Loading state: centered Lucide `Loader2` animate-spin

Layout:
- Fixed inset-0 z-[1000] bg-black flex flex-col
- Header: px-4 py-3 border-b border-white/[0.06] flex items-center justify-between
  - "POST" text-sm font-black uppercase tracking-widest text-white
  - X close button: Lucide X size 18 text-zinc-400 hover:text-white
- Scrollable content area: flex-1 overflow-y-auto
  - At top: render FeedPostCard (with reactions interactive, onReact wired up)
  - Divider: border-t border-white/[0.06] mx-4 my-4
  - Comments section label: "COMMENTS" text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 mb-3
  - Comments list: px-4 space-y-4
    - Each comment: flex gap-3
      - Avatar: w-7 h-7 rounded-full bg-zinc-900 border border-[#8B0000]/30 text-[9px] font-black text-[#8B0000] flex items-center justify-center — initials
      - Right side: name text-xs font-black text-white + dept text-[10px] text-zinc-500, below it comment text text-sm font-bold text-zinc-300, below that timestamp text-[10px] text-zinc-600
  - Empty comments state: "No comments yet. Be first." text-xs text-zinc-600 text-center py-8 font-bold
- Sticky bottom comment bar: border-t border-white/[0.06] px-4 py-3 flex gap-2 bg-zinc-950
  - Input: flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#8B0000]/50
  - Send button: w-9 h-9 rounded-xl bg-[#8B0000] hover:bg-[#A00000] flex items-center justify-center transition disabled:opacity-40
    - Lucide `Send` icon size 14 text-white
  - On send: call POST /api/posts/:id/comments, clear input, append new comment to list optimistically

---

## 8. Frontend — app/feed/page.tsx

Rename from /discover if it exists. Create at app/feed/page.tsx.

Page structure:

**Header:**
- "FEED" — text-xl font-black uppercase tracking-widest text-white
- No subtitle needed

**Filter tabs** (sticky below header, bg-zinc-950 border-b border-white/[0.06]):
- 3 tabs: "COLLEGE" | "FOLLOWING" | "EVERYONE"
- Tab style: text-[11px] font-black uppercase tracking-widest px-4 py-3 border-b-2 transition
- Active: border-[#8B0000] text-white
- Inactive: border-transparent text-zinc-500 hover:text-zinc-300

**Feed list:**
- Fetch GET /api/posts/feed?userId=X&filter=X&limit=20 on filter change
- Render list of FeedPostCard components, gap-4 or divided by border-t border-white/[0.06]
- Infinite scroll: on scroll to bottom, fetch next page using nextCursor. Append posts to list.
- Loading skeleton: 3 placeholder cards with animate-pulse bg-zinc-900 rounded-2xl h-64
- Empty state (no posts): centered, py-20
  - Text: "No posts yet." — text-sm font-black text-white uppercase tracking-widest
  - Below: "Complete a mission and post your recap." — text-xs text-zinc-500 font-bold mt-2

**PostDetailModal:**
- State: selectedPostId (number | null)
- Pass to PostDetailModal, open when onViewPost is called from any FeedPostCard

---

## 9. Navigation update

Find the nav component (likely in components/ or app/layout). 
- Change all "Discover" labels to "Feed"
- Change all /discover routes to /feed
- Nav icon for Feed: use Lucide `Rss` icon

---

## Final checklist before submitting

- [ ] No emoji anywhere except the 4 reaction emojis
- [ ] All accent colors are #8B0000, no gold/silver/bronze in feed UI
- [ ] RecapCard.tsx is untouched
- [ ] /discover renamed to /feed everywhere
- [ ] Prisma migration created and run
- [ ] Posts route mounted in server.js
- [ ] ShareToFeedSheet triggered from RecapCard action row (non-failed sessions only)
- [ ] Infinite scroll working on feed page
- [ ] PostDetailModal opens on "X comments" click
