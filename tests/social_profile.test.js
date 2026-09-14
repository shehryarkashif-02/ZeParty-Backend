import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getSocialProfile, updatePrivacySettings } from '../src/services/social.service.js';

describe('Phase 6 Social Profile & Privacy Suite', () => {
  it('exposes safe public social profile fields without leaking private data', async () => {
    const mockUser = {
      id: 'usr-target-1',
      username: 'target_star',
      avatarUrl: 'https://cdn.zeparty.app/avatars/target.jpg',
      bio: 'Live host & creator on ZeParty',
      status: 'ACTIVE',
      createdAt: new Date(),
      profile: {
        displayName: 'Target Star',
        level: 15,
        vipLevel: 3,
        svipLevel: 1,
        nobleRank: 'Duke',
        isPrivate: false,
        followersCount: 1500,
        followingCount: 200,
        postsCount: 45,
      },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockUser,
      },
      follow: {
        findUnique: async () => null,
      },
      userBlock: {
        findFirst: async () => null,
      },
    };

    const profile = await getSocialProfile('usr-target-1', 'usr-viewer-1', mockDb);

    assert.strictEqual(profile.id, 'usr-target-1');
    assert.strictEqual(profile.username, 'target_star');
    assert.strictEqual(profile.displayName, 'Target Star');
    assert.strictEqual(profile.followersCount, 1500);
    assert.strictEqual(profile.followingCount, 200);
    assert.strictEqual(profile.postsCount, 45);
    assert.strictEqual(profile.level, 15);
    assert.strictEqual(profile.nobleRank, 'Duke');
    assert.strictEqual(profile.isPrivate, false);
    assert.strictEqual(profile.canViewPosts, true);

    // Assert sensitive fields are absent
    assert.strictEqual(profile.email, undefined);
    assert.strictEqual(profile.phone, undefined);
    assert.strictEqual(profile.passwordHash, undefined);
    assert.strictEqual(profile.wallet, undefined);
  });

  it('restricts post visibility on private accounts for non-followers', async () => {
    const mockPrivateUser = {
      id: 'usr-private-1',
      username: 'private_user',
      avatarUrl: null,
      bio: 'Private profile',
      status: 'ACTIVE',
      createdAt: new Date(),
      profile: {
        displayName: 'Private Person',
        level: 5,
        isPrivate: true,
        followersCount: 10,
        followingCount: 10,
        postsCount: 12,
      },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockPrivateUser,
      },
      follow: {
        findUnique: async () => null, // Not following
      },
      userBlock: {
        findFirst: async () => null,
      },
    };

    const profile = await getSocialProfile('usr-private-1', 'usr-stranger', mockDb);

    assert.strictEqual(profile.isPrivate, true);
    assert.strictEqual(profile.isFollowing, false);
    assert.strictEqual(profile.canViewPosts, false, 'Non-followers cannot view posts of private accounts');
  });

  it('allows post visibility on private accounts when viewer is an accepted follower', async () => {
    const mockPrivateUser = {
      id: 'usr-private-2',
      username: 'private_friend',
      profile: {
        displayName: 'Private Friend',
        isPrivate: true,
        followersCount: 50,
      },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockPrivateUser,
      },
      follow: {
        findUnique: async ({ where }) => {
          if (where.followerId_followingId.followerId === 'usr-friend') {
            return { followerId: 'usr-friend', followingId: 'usr-private-2', status: 'ACCEPTED' };
          }
          return null;
        },
      },
      userBlock: {
        findFirst: async () => null,
      },
    };

    const profile = await getSocialProfile('usr-private-2', 'usr-friend', mockDb);

    assert.strictEqual(profile.isFollowing, true);
    assert.strictEqual(profile.canViewPosts, true, 'Accepted followers can view posts of private accounts');
  });

  it('updates account privacy settings', async () => {
    let updatedPrivate = null;
    const mockDb = {
      userProfile: {
        update: async (args) => {
          updatedPrivate = args.data.isPrivate;
          return { userId: 'usr-1', isPrivate: updatedPrivate };
        },
      },
    };

    const result = await updatePrivacySettings('usr-1', true, mockDb);
    assert.strictEqual(result.isPrivate, true);
    assert.strictEqual(updatedPrivate, true);
  });
});
