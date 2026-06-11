import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { getDb } from '../../src/db/connection';
import { useAuthStore } from '../../src/stores/authStore';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      const db = getDb();
      const user = db.getFirstSync(
        'SELECT id, username, name, role, gender, age, height, current_weight, goal_weight, goal, activity_level FROM users WHERE username = ? AND password = ?',
        [username.trim(), password.trim()]
      ) as any;
      if (user) {
        login(user);
      } else {
        Alert.alert('Error', 'Usuario o contrasena incorrectos');
      }
    } catch (e) {
      Alert.alert('Error', 'Ocurrio un problema al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.logo}>💪</Text>
          <Text style={styles.title}>GymApp</Text>
          <Text style={styles.subtitle}>Tu entrenamiento, tu ritmo</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Usuario</Text>
          <TextInput style={styles.input} placeholder="Ej: carlos_fit" placeholderTextColor={Colors.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>Contrasena</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.registerLink}>
          <Text style={styles.registerLinkText}>No tienes cuenta? Registrate gratis →</Text>
        </TouchableOpacity>

        <View style={styles.demo}>
          <Text style={styles.demoTitle}>Usuarios de prueba</Text>
          <Text style={styles.demoText}>demo / demo123</Text>
          <Text style={styles.demoText}>carlos_fit / gym123</Text>
          <Text style={styles.demoText}>trainer1 / gym123</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  form: { marginBottom: 20 },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 16, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.textPrimary, fontSize: 16 },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  registerLink: { alignItems: 'center', marginBottom: 20 },
  registerLinkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  demo: { alignItems: 'center', padding: 16, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  demoTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  demoText: { color: Colors.textMuted, fontSize: 13, marginBottom: 2 },
});