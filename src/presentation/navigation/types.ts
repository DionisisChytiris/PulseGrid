import type { NavigatorScreenParams } from '@react-navigation/native';

export type SongsStackParamList = {
  SongLibrary: undefined;
  SongEditor: { songId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Songs: NavigatorScreenParams<SongsStackParamList>;
  Settings: undefined;
};
