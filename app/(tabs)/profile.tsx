import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

interface Stats {
  totalRoutines: number;
  totalExercises: number;
  totalNutritionLogs: number;
  totalBodyStats: number;
  lastWeight: number | null;
}

const GOALS = ['Perder peso', 'Ganar musculo', 'Mantener peso', 'Mejorar resistencia', 'Mejorar fuerza'];
const ACTIVITY_LEVELS = ['Sedentario', 'Ligero', 'Moderado', 'Activo', 'Muy activo'];
const GENDERS = ['Masculino', 'Femenino', 'Otro'];

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ totalRoutines: 0, totalExercises: 0, totalNutritionLogs: 0, totalBodyStats: 0, lastWeight: null });
  const [showEdit, setShowEdit] = useState(false);
  const [gender, setGender] = useState(user?.gender || '');
  const [age, setAge] = useState(user?.age?.toString() || '');
  const [height, setHeight] = useState(user?.height?.toString() || '');
  const [currentWeight, setCurrentWeight] = useState(user?.current_weight?.toString() || '');
  const [goalWeight, setGoalWeight] = useState(user?.goal_weight?.toString() || '');
  const [goal, setGoal] = useState(user?.goal || '');
  const [activityLevel, setActivityLevel] = useState(user?.activity_level || '');

  const loadStats = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const routines = db.getFirstSync('SELECT COUNT(*) as c FROM routines WHERE user_id = ?', [user.id]) as { c: number };
    const exercises = db.getFirstSync('SELECT COUNT(*) as c FROM exercises e JOIN routines r ON e.routine_id = r.id WHERE r.user_id = ?', [user.id]) as { c: number };
    const nutrition = db.getFirstSync('SELECT COUNT(*) as c FROM nutrition_logs WHERE user_id = ?', [user.id]) as { c: number };
    const bodyStats = db.getFirstSync('SELECT COUNT(*) as c FROM body_stats WHERE user_id = ?', [user.id]) as { c: number };
    const lastStat = db.getFirstSync('SELECT weight FROM body_stats WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1', [user.id]) as { weight: number } | null;
    setStats({ totalRoutines: routines?.c || 0, totalExercises: exercises?.c || 0, totalNutritionLogs: nutrition?.c || 0, totalBodyStats: bodyStats?.c || 0, lastWeight: lastStat?.weight || null });
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const saveProfile = () => {
    const db = getDb();
    db.runSync(
      `UPDATE users SET gender=?, age=?, height=?, current_weight=?, goal_weight=?, goal=?, activity_level=? WHERE id=?`,
      [gender, parseInt(age)||0, parseFloat(height)||0, parseFloat(currentWeight)||0, parseFloat(goalWeight)||0, goal, activityLevel, user!.id]
    );
    updateProfile({ gender, age: parseInt(age)||0, height: parseFloat(height)||0, current_weight: parseFloat(currentWeight)||0, goal_weight: parseFloat(goalWeight)||0, goal, activity_level: activityLevel });
    setShowEdit(false);
    Alert.alert('Perfil actualizado', 'Tus datos han sido guardados.');
  };

  const profileComplete = !!(user?.gender && user?.age && user?.height && user?.current_weight && user?.goal);
  const roleLabel = user?.role === 'trainer' ? '🏋️ Entrenador' : user?.role === 'admin' ? '⚙️ Admin' : '💪 Atleta';
  const roleColor = user?.role === 'trainer' ? Colors.accent : user?.role === 'admin' ? Colors.warning : Colors.primary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', borderColor: roleColor }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>

        {!profileComplete && (
          <TouchableOpacity style={styles.completeProfileBtn} onPress={() => setShowEdit(true)}>
            <Text style={styles.completeProfileText}>⚠️ Completa tu perfil para mejor experiencia</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Datos fisicos */}
      {profileComplete && (
        <View style={styles.physicalSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Datos fisicos</Text>
            <TouchableOpacity onPress={() => setShowEdit(true)}>
              <Text style={styles.editLink}>Editar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.physicalGrid}>
            <View style={styles.physicalCard}>
              <Text style={styles.physicalEmoji}>⚥</Text>
              <Text style={styles.physicalValue}>{user?.gender}</Text>
              <Text style={styles.physicalLabel}>Sexo</Text>
            </View>
            <View style={styles.physicalCard}>
              <Text style={styles.physicalEmoji}>🎂</Text>
              <Text style={styles.physicalValue}>{user?.age}</Text>
              <Text style={styles.physicalLabel}>Edad</Text>
            </View>
            <View style={styles.physicalCard}>
              <Text style={styles.physicalEmoji}>📏</Text>
              <Text style={styles.physicalValue}>{user?.height}cm</Text>
              <Text style={styles.physicalLabel}>Altura</Text>
            </View>
            <View style={styles.physicalCard}>
              <Text style={styles.physicalEmoji}>⚖️</Text>
              <Text style={styles.physicalValue}>{user?.current_weight}kg</Text>
              <Text style={styles.physicalLabel}>Peso</Text>
            </View>
            <View style={styles.physicalCard}>
              <Text style={styles.physicalEmoji}>🎯</Text>
              <Text style={styles.physicalValue}>{user?.goal_weight}kg</Text>
              <Text style={styles.physicalLabel}>Meta</Text>
            </View>
            <View style={styles.physicalCard}>
              <Text style={styles.physicalEmoji}>🏃</Text>
              <Text style={[styles.physicalValue, { fontSize: 11 }]}>{user?.activity_level}</Text>
              <Text style={styles.physicalLabel}>Actividad</Text>
            </View>
          </View>
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>🎯 Objetivo: {user?.goal}</Text>
          </View>
        </View>
      )}

      {!profileComplete && (
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)}>
          <Text style={styles.editBtnText}>✏️ Editar perfil</Text>
        </TouchableOpacity>
      )}

      {/* Estadisticas */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Mis estadisticas</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderTopColor: Colors.primary }]}>
            <Text style={styles.statNumber}>{stats.totalRoutines}</Text>
            <Text style={styles.statLabel}>Rutinas</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: Colors.accent }]}>
            <Text style={styles.statNumber}>{stats.totalExercises}</Text>
            <Text style={styles.statLabel}>Ejercicios</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: Colors.secondary }]}>
            <Text style={styles.statNumber}>{stats.totalNutritionLogs}</Text>
            <Text style={styles.statLabel}>Comidas</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: Colors.warning }]}>
            <Text style={styles.statNumber}>{stats.totalBodyStats}</Text>
            <Text style={styles.statLabel}>Mediciones</Text>
          </View>
        </View>
      </View>

      {/* Cerrar sesion */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('Cerrar sesion', 'Seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: logout }])}>
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
        <Text style={styles.version}>GymApp v1.0.0 · SDK 54</Text>
      </View>

      {/* Modal editar perfil */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>

              <Text style={styles.fieldLabel}>Sexo</Text>
              <View style={styles.optionsRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity key={g} style={[styles.optionBtn, gender === g && styles.optionBtnActive]} onPress={() => setGender(g)}>
                    <Text style={[styles.optionBtnText, gender === g && styles.optionBtnTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Edad</Text>
              <TextInput style={styles.input} placeholder="Ej: 25" placeholderTextColor={Colors.textMuted} value={age} onChangeText={setAge} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>Altura (cm)</Text>
              <TextInput style={styles.input} placeholder="Ej: 175" placeholderTextColor={Colors.textMuted} value={height} onChangeText={setHeight} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>Peso actual (kg)</Text>
              <TextInput style={styles.input} placeholder="Ej: 80" placeholderTextColor={Colors.textMuted} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>Peso objetivo (kg)</Text>
              <TextInput style={styles.input} placeholder="Ej: 75" placeholderTextColor={Colors.textMuted} value={goalWeight} onChangeText={setGoalWeight} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>Objetivo principal</Text>
              <View style={styles.optionsCol}>
                {GOALS.map(g => (
                  <TouchableOpacity key={g} style={[styles.optionBtn, goal === g && styles.optionBtnActive]} onPress={() => setGoal(g)}>
                    <Text style={[styles.optionBtnText, goal === g && styles.optionBtnTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Nivel de actividad</Text>
              <View style={styles.optionsCol}>
                {ACTIVITY_LEVELS.map(a => (
                  <TouchableOpacity key={a} style={[styles.optionBtn, activityLevel === a && styles.optionBtnActive]} onPress={() => setActivityLevel(a)}>
                    <Text style={[styles.optionBtnText, activityLevel === a && styles.optionBtnTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.btnPrimary} onPress={saveProfile}>
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowEdit(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, backgroundColor: Colors.surface },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 40, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  username: { fontSize: 15, color: Colors.textSecondary, marginBottom: 10 },
  roleBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  roleText: { fontSize: 13, fontWeight: '700' },
  completeProfileBtn: { backgroundColor: Colors.warning + '22', borderWidth: 1, borderColor: Colors.warning, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  completeProfileText: { color: Colors.warning, fontSize: 13, fontWeight: '600' },
  physicalSection: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  editLink: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  physicalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  physicalCard: { width: '30%', backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  physicalEmoji: { fontSize: 20, marginBottom: 4 },
  physicalValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  physicalLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  goalBadge: { backgroundColor: Colors.primary + '22', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  goalBadgeText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  editBtn: { backgroundColor: Colors.card, margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  editBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  statsSection: { padding: 20 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 14, alignItems: 'center', borderTopWidth: 3 },
  statNumber: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  logoutSection: { padding: 20, alignItems: 'center' },
  logoutBtn: { width: '100%', backgroundColor: Colors.error + '22', borderWidth: 1, borderColor: Colors.error, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 16 },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 16 },
  version: { fontSize: 12, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  optionsCol: { gap: 8, marginBottom: 4 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  optionBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  optionBtnTextActive: { color: '#fff' },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16, marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
});