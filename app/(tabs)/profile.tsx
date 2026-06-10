import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  return (
    <View style={styles.c}>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.username}>@{user?.username}</Text>
      <TouchableOpacity style={styles.btn} onPress={logout}>
        <Text style={styles.btnText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  name: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  username: { fontSize: 16, color: Colors.textSecondary, marginBottom: 40 },
  btn: { backgroundColor: Colors.error, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});