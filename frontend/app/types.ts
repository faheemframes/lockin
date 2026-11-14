export interface User {
  id: number;
  name: string;
  username?: string | null;
  email?: string;
  email_verified?: boolean;
  college: string;
  college_id: number | string;
  department: string;
  reputation_score: number;
  location: string;
  bio?: string;
  instagram?: string;
  github?: string;
  interests?: string;
  campus_id?: number;
  campus_name?: string;
  verified_at?: string;
  avatar_url?: string | null;
}

export interface Mission {
  id: number;
  creator_id?: number | null;
  title: string;
  description: string;
  location: string;
  datetime?: string | null;
  creator_name?: string | null;
  creator_username?: string | null;
  creator_department?: string | null;
  is_system?: boolean;
  status?: string;
  showed_up?: boolean | null;
  role?: "creator" | "participant";
  participant_name?: string;
  participant_id?: number;
  creator_vibe_rating?: "W" | "L" | null;
  participant_vibe_rating?: "W" | "L" | null;
  participant_department?: string;
  participant_reputation?: number;
  verification_code?: string;
  category_name?: string;
  category_id?: number;
  category_emoji?: string;
  category_color?: string;
  mission_type?: string;
  focus_duration?: number;
  work_duration?: number;
  work_started_at?: string | null;
  cover_color?: string | null;
  cover_image?: string | null;
  is_event?: boolean;
  require_approval?: boolean;
  registration_q?: string | null;
  secret_info?: string | null;
  max_capacity?: number | null;
  application_note?: string | null;
  roster?: {
    pending: Array<{
      id: number;
      participant_id: number;
      user_id?: number;
      name: string;
      department?: string;
      reputation_score?: number;
      reputation_points?: number;
      avatar_url?: string | null;
      status?: string;
      showed_up?: boolean | null;
      application_note?: string | null;
    }>;
    going: Array<{
      id: number;
      participant_id: number;
      user_id?: number;
      name: string;
      department?: string;
      reputation_score?: number;
      reputation_points?: number;
      avatar_url?: string | null;
      status?: string;
      showed_up?: boolean | null;
      application_note?: string | null;
    }>;
    checkedIn?: Array<{
      id: number;
      participant_id: number;
      user_id?: number;
      name: string;
      department?: string;
      reputation_score?: number;
      reputation_points?: number;
      avatar_url?: string | null;
      status?: string;
      showed_up?: boolean | null;
      application_note?: string | null;
    }>;
    all?: Array<{
      id: number;
      participant_id: number;
      user_id?: number;
      name: string;
      department?: string;
      reputation_score?: number;
      reputation_points?: number;
      avatar_url?: string | null;
      status?: string;
      showed_up?: boolean | null;
      application_note?: string | null;
    }>;
  };
  locked_in_count?: number;
  attendees?: Array<{
    id: number;
    name: string;
    department: string;
    reputation_score: number;
    is_host: boolean;
    status?: string;
    showed_up?: boolean | null;
    application_note?: string | null;
  }>;
}

export interface Message {
  id: number;
  mission_id: number;
  sender_id: number;
  message: string;
  created_at: string;
  sender_name: string;
  sender_username?: string | null;
}

export interface InterestCategory {
  id: number;
  name: string;
  emoji: string | null;
  color: string;
}

export interface Post {
  id: number;
  userId: number;
  recapId?: number | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  caption?: string | null;
  visibility: "college" | "followers" | "everyone";
  createdAt: string;
  user: {
    id: number;
    name: string;
    username?: string | null;
    department: string;
    college: string;
    reputationScore: number;
    avatarUrl?: string | null;
  };
  recap?: {
    id: number;
    sessionDuration: number;
    tasksCompleted: number;
    streak: number;
    categorySnapshot: string;
    missionTitle: string;
    generatedAt: string;
  } | null;
  commentCount: number;
  reactionCounts: {
    "🔥": number;
    "💀": number;
    "❤️": number;
    "🧠": number;
  };
  userReactions: {
    "🔥": boolean;
    "💀": boolean;
    "❤️": boolean;
    "🧠": boolean;
  };
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  text: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    department: string;
  };
}


/** A person as the inbox shows them. */
export interface InboxPerson {
  id: number;
  name: string;
  username: string | null;
  avatar_url: string | null;
  department?: string | null;
}

export interface DmMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  kind: "text" | "image" | "voice";
  body: string;
  media_url: string | null;
  media_meta: { width?: number; height?: number; duration?: number; peaks?: number[] } | null;
  created_at: string;
}

export type Conversation =
  | {
      kind: "dm";
      key: string;
      thread_id: number;
      status: "active" | "request";
      incoming_request: boolean;
      outgoing_request: boolean;
      other: InboxPerson;
      last_message: DmMessage | null;
      last_at: string;
      unread: number;
    }
  | {
      kind: "mission";
      key: string;
      mission_id: number;
      title: string;
      is_host: boolean;
      mission_status: string | null;
      member_count: number;
      host: { id: number; name: string; username: string | null } | null;
      last_message: { id: number; sender_id: number; sender_name: string; body: string; created_at: string } | null;
      last_at: string;
      unread: number;
    };
