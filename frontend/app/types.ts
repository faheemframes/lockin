export interface User {
  id: number;
  name: string;
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
  incomplete?: boolean;
}

export interface Mission {
  id: number | string;
  creator_id: number | null;
  title: string;
  description: string;
  location: string | null;
  datetime: string | null;
  creator_name?: string;
  creator_department?: string;
  status?: string;
  showed_up?: boolean | null;
  role?: "creator" | "participant";
  participant_name?: string;
  participant_id?: number;
  participant_department?: string;
  participant_reputation?: number;
  verification_code?: string;
  category_name?: string;
  category_id?: number;
  category_emoji?: string;
  category_color?: string;
  mission_type?: string;
  focus_duration?: number;
  estimated_duration?: number;
  difficulty?: string | null;
  default_tasks?: string[];
  cover_color?: string | null;
  cover_image?: string | null;
  locked_in_count?: number;
  attendees?: Array<{
    id: number;
    name: string;
    department: string;
    reputation_score: number;
    is_host: boolean;
  }>;
  is_side_quest?: boolean;
  item_type?: "mission" | "side_quest";
  template_id?: number;
}

export interface Message {
  id: number;
  mission_id: number;
  sender_id: number;
  message: string;
  created_at: string;
  sender_name: string;
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

