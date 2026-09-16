# LOCKIN

> **Stop scrolling. Start showing up.**

LOCKIN is a college-focused mission platform built around accountability, execution, and real-world activity.

Instead of endlessly planning or chatting, users **lock in to missions**, execute them solo or with others, complete tasks, and build a record of their consistency.

### Core Loop

**Discover → Lock In → Execute → Complete → Recap → Build Aura → Repeat**

### What you can do

- Create and join **Solo & Group Missions**
- Set tasks, duration, time, and location
- Execute missions with a focused timer
- Verify attendance for group missions
- Track **Aura, streaks, and activity**
- Generate mission **recaps**
- Share activity through the social feed
- Follow users and explore public profiles
- Browse curated **LOCKIN Quests / Mission Templates**
- Add missions to Google Calendar, Outlook, or Apple Calendar

### Tech Stack

**Frontend:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · Framer Motion · Lucide React

**Backend:** Express / Vercel-compatible API architecture · Prisma

**Infrastructure:** Supabase PostgreSQL · Supabase Auth · Supabase Realtime · Supabase Storage · Resend

**Deployment:** Vercel · `lockin.top`

### Development

LOCKIN is designed as a **Vercel-first architecture**. Supabase handles the core backend infrastructure, while Resend handles email delivery.

Before making changes, read **`LOCKIN_HANDOFF.md`** for the complete product and engineering context.

> **Build things that make people lock in and actually show up.**
