const prisma = require("../config/db");
const memoryStore = require("../data/memoryStore");
const { isDbUnavailable } = require("../utils/dbFallback");

async function ensureParticipant(missionId, userId) {
  try {
    // 1. Check if the user is the creator of the mission
    const mission = await prisma.mission.findUnique({
      where: { id: Number(missionId) },
      select: { createdBy: true }
    });
    if (mission && mission.createdBy === Number(userId)) {
      return true;
    }

    // 2. Check if the user is an accepted/completed/missed participant
    const count = await prisma.participation.count({
      where: {
        missionId: Number(missionId),
        userId: Number(userId),
        status: { in: ["Accepted", "Completed", "Missed"] }
      }
    });
    return count > 0;
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    return memoryStore.ensureParticipant(missionId, userId);
  }
}

async function getMessages(req, res) {
  const { missionId } = req.params;
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  if (!(await ensureParticipant(missionId, userId))) {
    return res.status(403).json({ error: "Chat unlocks only after accepting the mission." });
  }

  try {
    const messages = await prisma.message.findMany({
      where: { missionId: Number(missionId) },
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: { name: true }
        }
      }
    });

    const rows = messages.map((msg) => ({
      id: msg.id,
      mission_id: msg.missionId,
      sender_id: msg.senderId,
      message: msg.message,
      created_at: msg.createdAt,
      sender_name: msg.sender.name
    }));

    res.json(rows);
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json(memoryStore.getMessages(missionId));
  }
}

async function sendMessage(req, res) {
  const { missionId } = req.params;
  const { senderId, message } = req.body;
  if (!senderId || !message || !message.trim()) {
    return res.status(400).json({ error: "senderId and message are required." });
  }

  if (!(await ensureParticipant(missionId, senderId))) {
    return res.status(403).json({ error: "Chat unlocks only after accepting the mission." });
  }

  try {
    const msg = await prisma.message.create({
      data: {
        missionId: Number(missionId),
        senderId: Number(senderId),
        message: message.trim()
      },
      include: {
        sender: {
          select: { name: true }
        }
      }
    });

    const response = {
      id: msg.id,
      mission_id: msg.missionId,
      sender_id: msg.senderId,
      message: msg.message,
      created_at: msg.createdAt,
      sender_name: msg.sender.name
    };

    // Broadcast real-time message through Supabase Realtime
    const supabaseClient = require("../config/supabase");
    if (supabaseClient) {
      const channel = supabaseClient.channel(`mission_chat:${missionId}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "new_message",
            payload: response
          }).catch(err => console.error("Realtime broadcast failed:", err));
        }
      });
    }

    res.status(201).json(response);
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    const response = memoryStore.sendMessage(missionId, senderId, message.trim());
    
    // Broadcast real-time message through Supabase Realtime
    const supabaseClient = require("../config/supabase");
    if (supabaseClient) {
      const channel = supabaseClient.channel(`mission_chat:${missionId}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "new_message",
            payload: response
          }).catch(err => console.error("Realtime broadcast failed:", err));
        }
      });
    }
    res.status(201).json(response);
  }
}

module.exports = { getMessages, sendMessage };
