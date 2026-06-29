import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  Home: undefined;
  QuickMetronome: undefined;
};

export type SongsStackParamList = {
  SongLibrary: undefined;
  SongEditor: undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Songs: NavigatorScreenParams<SongsStackParamList>;
  Settings: undefined;
};
