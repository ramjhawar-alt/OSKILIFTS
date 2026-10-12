# OSKILIFTS design system and app structure

The app is **mobile-first and dark**. The website is the same code shown as a phone-width column on
desktop. Everything new is styled from `src/theme/index.ts` (never raw hex colors).

## Look
- Dark Berkeley navy surfaces, **California Gold** for the one main action and highlights, **Lawrence cyan** as the cool accent.
- Heavy, tight type for display text. Cards are dark "glass" (`Card`), hairline borders, big radii.
- **One solid gold button per screen** (`PrimaryButton`); everything else is outlined (`GhostButton`, or `goldSoft` + gold border).
- 48 pt minimum touch targets (`TOUCH`), haptics on taps (`src/utils/haptics.ts`).

## Navigation (bottom bar, `src/components/AppTabBar.tsx`)
**Today · Feed · ＋Log · RSF · Me.** The center gold Log button opens the logging screen (resuming a draft if one is
in progress); the bar hides on that screen. Every tab's stack includes the shared screen set (`commonScreens()` in
`RootNavigator.tsx`), so profiles, workouts, etc. open inside whichever tab you are on.
- **Today:** your bear + streak + level progress (hero), Log button, RSF at a glance, weekly goal, friends modules.
- **RSF hub:** live crowd, classes, Hoopers, "heading to the RSF", friends there, quiet hours.
- **Me:** profile, workout history, routines, exercises, settings.

## Rollout
1. **Phase 1 (done):** design system, navigation, Today, RSF hub.
2. Phase 2: Log Workout screen. 3. Phase 3: Feed, Me/profile, other legacy screens (they are still light-themed, with a dark header).

Screens not yet redone still use their old light styling (`ScreenContainer`). Convert them to `DarkScreen` + `Card` as they are redesigned.
