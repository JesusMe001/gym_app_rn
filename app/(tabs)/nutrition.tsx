import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme/colors';
export default function NutritionScreen() {
  return <View style={styles.c}><Text style={styles.t}>🥗 Nutricion - Proximamente</Text></View>;
}
const styles = StyleSheet.create({ c: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }, t: { color: Colors.textSecondary, fontSize: 18 } });