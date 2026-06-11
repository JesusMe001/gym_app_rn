import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Colors } from '../../src/theme/colors';
import { getDb } from '../../src/db/connection';
import { useAuthStore } from '../../src/stores/authStore';

const GOALS = ['Perder peso', 'Ganar musculo', 'Mantener peso', 'Mejorar resistencia'];
const GENDERS = ['Masculino', 'Femenino', 'Otro'];

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const validateStep1 = () => {
    if (!name.trim()) { Alert.alert('Error', 'Escribe tu nombre'); return false; }
    if (!username.trim()) { Alert.alert('Error', 'Escribe un usuario'); return false; }
    if (username.length < 4) { Alert.alert('Error', 'El usuario debe tener al menos 4 caracteres'); return false; }
    if (!password.trim()) { Alert.alert('Error', 'Escribe una contrasena'); return false; }
    if (password.length < 6) { Alert.alert('Error', 'La contrasena debe tener al menos 6 caracteres'); return false; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Las contrasenas no coinciden'); return false; }
    return true;
  };

  const handleRegister = () => {
    if (!gender) { Alert.alert('Error', 'Selecciona tu sexo'); return; }
    if (!goal) { Alert.alert('Error', 'Selecciona tu objetivo'); return; }
    setLoading(true);
    try {
      const db = getDb();
      const existing = db.getFirstSync('SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]);
      if (existing) { Alert.alert('Error', 'Ese nombre de usuario ya existe'); setLoading(false); return; }

      const result = db.runSync(
        'INSERT INTO users (username, password, name, role, gender, age, height, current_weight, goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username.trim().toLowerCase(), password, name.trim(), 'user', gender, parseInt(age)||0, parseFloat(height)||0, parseFloat(weight)||0, goal]
      );

      const newUser = db.getFirstSync('SELECT id, username, name, role, gender, age, height, current_weight, goal FROM users WHERE id = ?', [result.lastInsertRowId]) as any;
      login(newUser);
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>💪</Text>
          <Text style={styles.title}>GymApp</Text>
          <Text style={styles.subtitle}>Crea tu cuenta gratis</Text>
        </View>

        {/* Steps indicator */}
        <View style={styles.stepsRow}>
          <View style={[styles.step, step >= 1 && styles.stepActive]}>
            <Text style={[styles.stepText, step >= 1 && styles.stepTextActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.step, step >= 2 && styles.stepActive]}>
            <Text style={[styles.stepText, step >= 2 && styles.stepTextActive]}>2</Text>
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            <Text style={styles.stepTitle}>Datos de acceso</Text>

            <Text style={styles.label}>Nombre completo</Text>
            <TextInput style={styles.input} placeholder="Ej: Carlos Rodriguez" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />

            <Text style={styles.label}>Usuario</Text>
            <TextInput style={styles.input} placeholder="Ej: carlos_fit" placeholderTextColor={Colors.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />

            <Text style={styles.label}>Contrasena</Text>
            <TextInput style={styles.input} placeholder="Minimo 6 caracteres" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />

            <Text style={styles.label}>Confirmar contrasena</Text>
            <TextInput style={styles.input} placeholder="Repite tu contrasena" placeholderTextColor={Colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

            <TouchableOpacity style={styles.button} onPress={() => { if (validateStep1()) setStep(2); }}>
              <Text style={styles.buttonText}>Siguiente →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.stepTitle}>Tu perfil fitness</Text>

            <Text style={styles.label}>Sexo</Text>
            <View style={styles.optionsRow}>
              {GENDERS.map(g => (
                <TouchableOpacity key={g} style={[styles.optionBtn, gender === g && styles.optionBtnActive]} onPress={() => setGender(g)}>
                  <Text style={[styles.optionText, gender === g && styles.optionTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Edad</Text>
                <TextInput style={styles.input} placeholder="25" placeholderTextColor={Colors.textMuted} value={age} onChangeText={setAge} keyboardType="numeric" />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Altura (cm)</Text>
                <TextInput style={styles.input} placeholder="175" placeholderTextColor={Colors.textMuted} value={height} onChangeText={setHeight} keyboardType="numeric" />
              </View>
            </View>

            <Text style={styles.label}>Peso actual (kg)</Text>
            <TextInput style={styles.input} placeholder="Ej: 80" placeholderTextColor={Colors.textMuted} value={weight} onChangeText={setWeight} keyboardType="numeric" />

            <Text style={styles.label}>Objetivo principal</Text>
            <View style={styles.optionsCol}>
              {GOALS.map(g => (
                <TouchableOpacity key={g} style={[styles.goalBtn, goal === g && styles.goalBtnActive]} onPress={() => setGoal(g)}>
                  <Text style={[styles.goalBtnText, goal === g && styles.goalBtnTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Crear cuenta 🚀</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>← Volver</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => Alert.alert('Iniciar sesion', 'Ve a la pantalla de login')}>
          <Text style={styles.loginLink}>Ya tienes cuenta? Inicia sesion</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border },
  stepActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepText: { color: Colors.textMuted, fontWeight: '700' },
  stepTextActive: { color: '#fff' },
  stepLine: { width: 60, height: 2, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },
  stepTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },
  form: { marginBottom: 24 },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12, fontWeight: '600', textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.textPrimary, fontSize: 16 },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  backBtn: { alignItems: 'center', marginTop: 12 },
  backBtnText: { color: Colors.textSecondary, fontSize: 15 },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionsCol: { gap: 8 },
  optionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  optionBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionText: { color: Colors.textSecondary, fontWeight: '600' },
  optionTextActive: { color: '#fff' },
  goalBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  goalBtnActive: { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  goalBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  goalBtnTextActive: { color: Colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  loginLink: { color: Colors.textSecondary, textAlign: 'center', fontSize: 14, textDecorationLine: 'underline' },
});