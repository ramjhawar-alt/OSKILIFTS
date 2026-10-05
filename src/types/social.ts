export interface Profile {
  id: string;
  username: string | null;
  displayName: string | null;
  termsAcceptedAt: string | null;
}

export function isProfileComplete(profile: Profile): boolean {
  return Boolean(profile.username && profile.termsAcceptedAt);
}

export type Relationship = 'self' | 'none' | 'following' | 'pending_out' | 'pending_in';

export interface ProfileSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  followerCount: number;
  followingCount: number;
  relationship: Relationship;
  // Only present for yourself or people you follow.
  workoutCount: number | null;
  workoutDates: string[] | null;
}

export interface SearchResult {
  id: string;
  username: string;
  displayName: string | null;
  relationship: Relationship;
}

export interface FollowRequest {
  followerId: string;
  username: string | null;
  displayName: string | null;
  createdAt: string;
}

export interface FeedItem {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  date: string;
  dayType: { name: string; isCustom: boolean };
  exercises: import('./workout').ExerciseEntry[];
  notes?: string;
  // Raw string from the server; pass it back unchanged as the next cursor
  // (a JS Date round-trip would truncate microseconds).
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface BlockedUser {
  userId: string;
  username: string | null;
  displayName: string | null;
}
