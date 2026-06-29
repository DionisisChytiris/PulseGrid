import { StyleSheet, Text, View } from 'react-native';

export default function SongLibraryScreen() {
  return (
    <View style={styles.container}>
      <Text>Song Library</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
