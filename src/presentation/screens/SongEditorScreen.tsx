import { StyleSheet, Text, View } from 'react-native';

export default function SongEditorScreen() {
  return (
    <View style={styles.container}>
      <Text>Song Editor</Text>
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
