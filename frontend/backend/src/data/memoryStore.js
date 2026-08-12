const now = Date.now();

const users = [
  { id: 101, name: "Faheem", college: "SRM Institute of Science and Technology KTR", college_id: "faheem@srmist.edu.in", department: "Networking and Communications", reputation_score: 80, location: "SRM KTR Library" },
  { id: 102, name: "Rayaan", college: "SRM Institute of Science and Technology KTR", college_id: "rayaan@srmist.edu.in", department: "Networking and Communications", reputation_score: 90, location: "SRM KTR Tech Park" },
  { id: 103, name: "Aarav Mehta", college: "SRM Institute of Science and Technology KTR", college_id: "aarav@srmist.edu.in", department: "Computer Science Engineering", reputation_score: 40, location: "SRM KTR Main Campus" },
  { id: 104, name: "Maya Rao", college: "SRM Institute of Science and Technology KTR", college_id: "maya@srmist.edu.in", department: "Information Technology", reputation_score: 55, location: "SRM KTR Library" },
  { id: 105, name: "Kabir Sethi", college: "SRM Institute of Science and Technology KTR", college_id: "kabir@srmist.edu.in", department: "Computer Science Engineering", reputation_score: 15, location: "SRM KTR Hostel A" },
  { id: 106, name: "Ira Thomas", college: "SRM Institute of Science and Technology KTR", college_id: "ira@srmist.edu.in", department: "Electronics and Communication", reputation_score: 25, location: "SRM KTR Innovation Centre" },
  { id: 107, name: "Dev Nair", college: "SRM Institute of Science and Technology KTR", college_id: "dev@srmist.edu.in", department: "Computer Science Engineering", reputation_score: 70, location: "SRM KTR Sports Complex" },
  { id: 108, name: "Nisha Khan", college: "SRM Institute of Science and Technology KTR", college_id: "nisha@srmist.edu.in", department: "Data Science", reputation_score: 80, location: "SRM KTR Cafe Court" },
  { id: 109, name: "Rohan Das", college: "SRM Institute of Science and Technology KTR", college_id: "rohan@srmist.edu.in", department: "Artificial Intelligence", reputation_score: 35, location: "SRM KTR Seminar Hall" },
  { id: 110, name: "Tara Iyer", college: "SRM Institute of Science and Technology KTR", college_id: "tara@srmist.edu.in", department: "Data Science", reputation_score: 45, location: "SRM KTR Library" }
];

const missions = [
  ["Hackathon Grind", "All-night coding session to build the MVP. Bring caffeine.", "SRM KTR Library", 4, 101],
  ["LeetCode Lock-In", "Solving 5 hard/medium problems on arrays and graphs.", "SRM KTR Tech Park", 7, 102],
  ["API Battle Test", "Load testing express endpoints and optimizing performance.", "SRM KTR Computer Lab 2", 24, 103],
  ["Pitch Deck Build", "Design pitch slides and polish the demo script.", "SRM KTR Seminar Hall", 28, 104],
  ["Database Schema Jam", "Designing optimal relational tables and indexes.", "SRM KTR DBMS Lab", 48, 105],
  ["Open Source Fix Run", "Squashing open bugs in our target repo. Let's contribute.", "SRM KTR Innovation Centre", 52, 106],
  ["DSA Mock Duel", "1v1 mock interview sessions on tree traversal.", "SRM KTR Block C", 72, 107],
  ["Frontend Polish Night", "Adding Framer Motion micro-animations to improve UI feel.", "SRM KTR Design Studio", 76, 108],
  ["Backend Deploy Squad", "Setting up docker and deploying Express services.", "SRM KTR Networking Lab", 96, 109],
  ["Final Demo Rehearsal", "Simulating public presentation and timing of slides.", "SRM KTR Auditorium Lobby", 120, 110]
].map(([title, description, location, hours, creator_id], index) => ({
  id: index + 201,
  creator_id,
  title,
  description,
  location,
  datetime: new Date(now + hours * 3600000).toISOString()
}));

const participants = [
  { mission_id: 201, user_id: 102, status: "Completed", showed_up: true },
  { mission_id: 202, user_id: 101, status: "Pending", showed_up: null },
  { mission_id: 203, user_id: 107, status: "Completed", showed_up: true },
  { mission_id: 204, user_id: 108, status: "Missed", showed_up: false }
];

const messages = [
  { id: 1, mission_id: 201, sender_id: 102, message: "Locked in. I will bring the DBMS report queries.", created_at: new Date().toISOString() },
  { id: 2, mission_id: 202, sender_id: 101, message: "I am taking arrays and graphs first.", created_at: new Date().toISOString() }
];

let nextUserId = 111;
let nextMissionId = 211;
let nextMessageId = 3;

function creatorFields(mission) {
  const creator = users.find((user) => user.id === mission.creator_id);
  return {
    ...mission,
    creator_name: creator?.name || "Unknown",
    creator_department: creator?.department || "Creator"
  };
}

function createUser(payload) {
  const user = { id: nextUserId++, reputation_score: 0, ...payload };
  users.push(user);
  return user;
}

function getUser(id) {
  return users.find((user) => user.id === Number(id));
}

function getLockStatus(userId) {
  const active_count = participants.filter((item) => item.user_id === Number(userId) && item.showed_up === null).length;
  return { locked: active_count >= 3, active_count, max_active_missions: 3 };
}

function createMission(payload) {
  const mission = { id: nextMissionId++, ...payload };
  missions.push(mission);
  return creatorFields(mission);
}

function getMissionFeed(userId, categoryId) {
  const numericUserId = Number(userId);
  const accepted = new Set(participants.filter((item) => item.user_id === numericUserId).map((item) => item.mission_id));
  return missions
    .filter((mission) => {
      const matchUser = mission.creator_id !== numericUserId && !accepted.has(mission.id);
      if (!matchUser) return false;
      if (categoryId && categoryId !== "all") {
        return Number(mission.category_id) === Number(categoryId);
      }
      return true;
    })
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    .map(creatorFields);
}

function acceptMission(missionId, userId) {
  const numericMissionId = Number(missionId);
  const numericUserId = Number(userId);
  const mission = missions.find((item) => item.id === numericMissionId);
  if (!mission) return { error: "Mission not found.", status: 404 };
  if (getLockStatus(numericUserId).locked) {
    return { error: "You are locked in. Mark attendance before accepting more missions.", status: 423 };
  }
  const existing = participants.find((item) => item.mission_id === numericMissionId && item.user_id === numericUserId);
  if (existing) existing.status = "Requested";
  else participants.push({ mission_id: numericMissionId, user_id: numericUserId, status: "Requested", showed_up: null });
  return { mission_id: numericMissionId, user_id: numericUserId, status: "Requested" };
}

function getActiveMissions(userId) {
  return participants
    .filter((item) => item.user_id === Number(userId))
    .map((item) => ({ ...creatorFields(missions.find((mission) => mission.id === item.mission_id)), status: item.status, showed_up: item.showed_up }))
    .filter((item) => item.id)
    .sort((a, b) => Number(a.showed_up !== null) - Number(b.showed_up !== null) || new Date(a.datetime) - new Date(b.datetime));
}

function submitAttendance(missionId, userId, showedUp, code) {
  const participant = participants.find((item) => item.mission_id === Number(missionId) && item.user_id === Number(userId));
  if (!participant) return { error: "Accepted mission not found.", status: 404 };
  if (participant.showed_up !== null) return { error: "Attendance has already been submitted.", status: 409 };
  participant.showed_up = showedUp;
  participant.status = showedUp ? "Completed" : "Missed";
  const user = getUser(userId);
  user.reputation_score += showedUp ? 10 : -5;
  return { mission_id: Number(missionId), user_id: Number(userId), status: participant.status, reputation_score: user.reputation_score };
}

function ensureParticipant(missionId, userId) {
  return participants.some((item) => item.mission_id === Number(missionId) && item.user_id === Number(userId));
}

function getMessages(missionId) {
  return messages
    .filter((message) => message.mission_id === Number(missionId))
    .map((message) => ({ ...message, sender_name: getUser(message.sender_id)?.name || "Unknown" }));
}

function sendMessage(missionId, senderId, text) {
  const message = {
    id: nextMessageId++,
    mission_id: Number(missionId),
    sender_id: Number(senderId),
    message: text,
    created_at: new Date().toISOString()
  };
  messages.push(message);
  return { ...message, sender_name: getUser(senderId)?.name || "Unknown" };
}

module.exports = {
  createUser,
  getUser,
  getLockStatus,
  createMission,
  getMissionFeed,
  acceptMission,
  getActiveMissions,
  submitAttendance,
  ensureParticipant,
  getMessages,
  sendMessage
};
