import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FriendAtRsfRow } from '../components/FriendAtRsfRow';
import { ScreenContainer } from '../components/ScreenContainer';
import { useRsfPresence } from '../contexts/RsfPresenceContext';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FriendsAtRsf'>;

/** Who's at the RSF right now: friends only, each with their bear lifting. */
export const FriendsAtRsfScreen = () => {
  const navigation = useNavigation<Nav>();
  const { friendsAtRsf, refreshFriends, sharing } = useRsfPresence();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Pick up arrivals and departures while the screen is open.
  useEffect(() => {
    refreshFriends();
    const timer = setInterval(() => {
      setNow(Date.now());
      refreshFriends();
    }, 30_000);
    return () => clearInterval(timer);
  }, [refreshFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFriends();
    setNow(Date.now());
    setRefreshing(false);
  }, [refreshFriends]);

  return (
    <ScreenContainer>
      <FlatList
        data={friendsAtRsf}
        keyExtractor={(friend) => friend.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Friends at the RSF</Text>
            <Text style={styles.sub}>
              {friendsAtRsf.length === 0
                ? 'Nobody you follow back is at the RSF right now.'
                : `${friendsAtRsf.length} ${friendsAtRsf.length === 1 ? 'friend is' : 'friends are'} lifting right now.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FriendAtRsfRow
            friend={item}
            nowMs={now}
            onPress={() => navigation.push('UserProfile', { userId: item.id })}
          />
        )}
        ListFooterComponent={
          <Text style={styles.footer}>
            {sharing
              ? 'Only friends (people you follow who follow you back) who share when they’re at the RSF show up here. Your exact location is never sent.'
              : 'You’re not sharing, so friends can’t see you here. You can turn it on from the Home screen.'}
          </Text>
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: { marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  footer: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 12, marginBottom: 24, paddingHorizontal: 8 },
});
