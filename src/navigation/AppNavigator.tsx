import React from "react";
import {
  DefaultTheme,
  NavigationContainer,
  NavigationIndependentTree,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme";
import VerseScreen from "../screens/VerseScreen";
import SharhScreen from "../screens/SharhScreen";

export type SharhFromContext = {
  screen: string;
  verseId: string;
  selectionStart?: number;
  selectionEnd?: number;
  scrollY?: number;
};

export type RootStackParamList = {
  Verse: { verseId?: string; restoreY?: number } | undefined;
  Sharh: {
    conceptId: string;
    paragraphId?: string;
    from?: SharhFromContext;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export default function AppNavigator() {
  return (
    <NavigationIndependentTree>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          initialRouteName="Verse"
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="Verse" component={VerseScreen} />
          <Stack.Screen name="Sharh" component={SharhScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}
