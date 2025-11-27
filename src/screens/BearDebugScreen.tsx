import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../components/ScreenContainer';
import { OskiBear } from '../components/OskiBear';
import { AnimatedOskiLifting } from '../components/AnimatedOskiLifting';
import { getBearStage, getBearStageName } from '../services/bearStreakService';

const DEBUG_STREAK_KEY = '@oskilifts:debugStreak';
const DEBUG_TOTAL_WORKOUTS_KEY = '@oskilifts:debugTotalWorkouts';

export const BearDebugScreen = () => {
  const navigation = useNavigation();
  const [selectedStreak, setSelectedStreak] = useState(0);
  const [selectedStage, setSelectedStage] = useState(1);
  
  const handleUseStage = async (threshold: typeof stageThresholds[0]) => {
    try {
      // Store debug values in AsyncStorage
      await AsyncStorage.setItem(DEBUG_STREAK_KEY, threshold.min.toString());
      await AsyncStorage.setItem(DEBUG_TOTAL_WORKOUTS_KEY, Math.max(threshold.min, 10).toString());
      
      // Navigate back to home screen
      navigation.goBack();
      
      Alert.alert(
        'Debug Mode Applied',
        `Home screen will now show Stage ${threshold.stage} (${threshold.min} day streak)`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error applying debug settings:', error);
      Alert.alert('Error', 'Failed to apply debug settings');
    }
  };

  const stageThresholds = [
    { stage: 1, min: 0, max: 2, label: 'Stage 1: Baby Oski (0-2 days)' },
    { stage: 2, min: 3, max: 4, label: 'Stage 2: Small Oski (3-4 days)' },
    { stage: 3, min: 5, max: 6, label: 'Stage 3: Young Oski (5-6 days)' },
    { stage: 4, min: 7, max: 9, label: 'Stage 4: Growing Oski (7-9 days)' },
    { stage: 5, min: 10, max: 13, label: 'Stage 5: Strong Oski (10-13 days)' },
    { stage: 6, min: 14, max: 19, label: 'Stage 6: Big Oski (14-19 days)' },
    { stage: 7, min: 20, max: 29, label: 'Stage 7: Huge Oski (20-29 days)' },
    { stage: 8, min: 30, max: 44, label: 'Stage 8: Massive Oski (30-44 days)' },
    { stage: 9, min: 45, max: 59, label: 'Stage 9: Legendary Oski (45-59 days)' },
    { stage: 10, min: 60, max: 100, label: 'Stage 10: MAX OSKI (60+ days)' },
  ];

  const currentStage = getBearStage(selectedStreak);
  const totalWorkouts = Math.max(selectedStreak, 10); // Simulate total workouts

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Oski Bear Debug Preview</Text>
          <Text style={styles.subtitle}>
            Preview all bear stages and test different streak values
          </Text>
        </View>

        {/* Live Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Live Preview</Text>
          <Text style={styles.previewInfo}>
            Streak: {selectedStreak} days → Stage {currentStage}/10
          </Text>
          <OskiBear streak={selectedStreak} totalWorkouts={totalWorkouts} />
        </View>

        {/* Streak Input */}
        <View style={styles.controlSection}>
          <Text style={styles.sectionTitle}>Adjust Streak</Text>
          <View style={styles.streakInputContainer}>
            <TouchableOpacity
              style={styles.streakButton}
              onPress={() => setSelectedStreak(Math.max(0, selectedStreak - 1))}
            >
              <Text style={styles.streakButtonText}>−</Text>
            </TouchableOpacity>
            <View style={styles.streakDisplay}>
              <TextInput
                style={styles.streakInput}
                value={selectedStreak.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num >= 0) {
                    setSelectedStreak(Math.min(100, num));
                  }
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <Text style={styles.streakLabel}>days</Text>
            </View>
            <TouchableOpacity
              style={styles.streakButton}
              onPress={() => setSelectedStreak(Math.min(100, selectedStreak + 1))}
            >
              <Text style={styles.streakButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickButtons}>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setSelectedStreak(0)}
            >
              <Text style={styles.quickButtonText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setSelectedStreak(10)}
            >
              <Text style={styles.quickButtonText}>10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setSelectedStreak(30)}
            >
              <Text style={styles.quickButtonText}>30</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setSelectedStreak(60)}
            >
              <Text style={styles.quickButtonText}>60</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setSelectedStreak(100)}
            >
              <Text style={styles.quickButtonText}>100</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stage Buttons */}
        <View style={styles.controlSection}>
          <Text style={styles.sectionTitle}>Quick Stage Select</Text>
          <View style={styles.stageButtons}>
            {stageThresholds.map((threshold) => (
              <TouchableOpacity
                key={threshold.stage}
                style={[
                  styles.stageButton,
                  selectedStage === threshold.stage && styles.stageButtonActive,
                ]}
                onPress={() => {
                  setSelectedStage(threshold.stage);
                  setSelectedStreak(threshold.min);
                }}
              >
                <Text
                  style={[
                    styles.stageButtonText,
                    selectedStage === threshold.stage &&
                      styles.stageButtonTextActive,
                  ]}
                >
                  {threshold.stage}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* All Stages Gallery */}
        <View style={styles.gallerySection}>
          <Text style={styles.sectionTitle}>All Stages Gallery</Text>
          {stageThresholds.map((threshold) => {
            const sizeMultipliers: Record<number, number> = {
              1: 0.5, 2: 0.6, 3: 0.7, 4: 0.8, 5: 0.9,
              6: 1.0, 7: 1.1, 8: 1.2, 9: 1.3, 10: 1.5,
            };
            const bearSize = sizeMultipliers[threshold.stage] || 1.0;
            const stageName = getBearStageName(threshold.stage);
            
            return (
              <View key={threshold.stage} style={styles.stageCard}>
                <View style={styles.stageCardHeader}>
                  <Text style={styles.stageCardTitle}>
                    {threshold.label} - {stageName}
                  </Text>
                  <TouchableOpacity
                    style={styles.useButton}
                    onPress={() => handleUseStage(threshold)}
                  >
                    <Text style={styles.useButtonText}>Use</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.stageArtContainer}>
                  <AnimatedOskiLifting 
                    size={bearSize} 
                    stage={threshold.stage}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  previewSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  previewInfo: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  controlSection: {
    marginBottom: 32,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  streakInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  streakButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#003262',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  streakButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  streakDisplay: {
    alignItems: 'center',
    minWidth: 100,
  },
  streakInput: {
    fontSize: 36,
    fontWeight: '700',
    color: '#003262',
    textAlign: 'center',
    minWidth: 80,
    borderBottomWidth: 2,
    borderBottomColor: '#003262',
    paddingVertical: 4,
  },
  streakLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  quickButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003262',
  },
  stageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stageButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  stageButtonActive: {
    backgroundColor: '#003262',
    borderColor: '#003262',
  },
  stageButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  stageButtonTextActive: {
    color: '#ffffff',
  },
  gallerySection: {
    marginBottom: 32,
  },
  stageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stageCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  useButton: {
    backgroundColor: '#003262',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  useButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  stageArtContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 200,
  },
});

