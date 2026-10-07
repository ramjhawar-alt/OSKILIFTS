import type { WeightUnit } from '../domain/units';

export interface Profile {
  id: string;
  username: string | null;
  displayName: string | null;
  termsAcceptedAt: string | null;
  weightUnit: WeightUnit;
  isPublic: boolean;
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
  isPublic: boolean;
  // They follow me (accepted). With relationship 'following' this means friends.
  followsYou: boolean;
}

export interface SearchResult {
  id: string;
  username: string;
  displayName: string | null;
  relationship: Relationship;
}

export type ConnectionKind = 'followers' | 'following';

export interface ConnectionUser {
  id: string;
  username: string;
  displayName: string | null;
  relationship: Relationship;
  // Raw string from the server; pass it back unchanged as the next cursor.
  createdAt: string;
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
  exercises: import('./workout').EntryData[];
  notes?: string;
  // Raw string from the server; pass it back unchanged as the next cursor
  // (a JS Date round-trip would truncate microseconds).
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  // Filled in by a second call after the feed page loads; 0 until then.
  commentCount: number;
  // Only set on profile lists, where your own only-me workouts also appear.
  visibility?: 'followers' | 'private';
}

export interface WorkoutComment {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  body: string;
  // Raw string from the server; pass it back unchanged as the next cursor.
  createdAt: string;
  canDelete: boolean;
}

export interface BlockedUser {
  userId: string;
  username: string | null;
  displayName: string | null;
}
