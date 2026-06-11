import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
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

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    totalRoutines: 0,
    totalExercises: 0,
    totalNutritionLogs: 0,
    totalBodyStats: 0,
    lastWeight: null,
  });

  const loadStats = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const routines = db.getFirstSync('SELECT COUNT(*) as c FROM routines WHERE user_id = ?', [user.id]) as { c: number };
    const exercises = db.getFirstSync('SELECT COUNT(*) as c FROM exercises e JOIN routines r ON e.routine_id = r.id WHERE r.user_id = ?', [user.id]) as { c: number };
    const nutrition = db.getFirstSync('SELECT COUNT(*) as c FROM nutrition_logs WHERE user_id = ?', [user.id]) as { c: number };
    const bodyStats = db.getFirstSync('SELECT COUNT(*) as c FROM body_stats WHERE user_id = ?', [user.id]) as { c: number };
    const lastStat = db.getFirstSync('SELECT weight FROM body_stats WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1', [user.id]) as { weight: number } | null;
    setStats({
      totalRoutines: routines?.c || 0,
      totalExercises: exercises?.c || 0,
      totalNutritionLogs: nutrition?.c || 0,
      totalBodyStats: bodyStats?.c || 0,
      lastWeight: lastStat?.weight || null,
    });
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleLogout = () => {
    Alert.alert('Cerrar sesion', 'Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const roleLabel = user?.role === 'trainer' ? '🏋️ Entrenador' : user?.role === 'admin' ? '⚙️ Admin' : '💪 Atleta';
  const roleColor = user?.role === 'trainer' ? Colors.accent : user?.role === 'admin' ? Colors.warning : Colors.primary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Avatar y datos */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', borderColor: roleColor }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
        {stats.lastWeight && (
          <Text style={styles.weightText}>Peso actual: {stats.lastWeight} kg</Text>
        )}
      </View>

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

      {/* Menu opciones */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Configuracion</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuEmoji}>🎯</Text>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Mis objetivos</Text>
            <Text style={styles.menuSub}>Define tus metas de entrenamiento</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuEmoji}>🔔</Text>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Notificaciones</Text>
            <Text style={styles.menuSub}>Recordatorios de entrenamiento</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuEmoji}>🤖</Text>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>AI Coach</Text>
            <Text style={styles.menuSub}>Tu asistente personal de fitness</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        {user?.role === 'trainer' && (
          <TouchableOpacity style={[styles.menuItem, { borderLeftColor: Colors.accent }]}>
            <Text style={styles.menuEmoji}>👥</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Panel de entrenador</Text>
              <Text style={styles.menuSub}>Gestiona tus clientes</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cerrar sesion */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
        <Text style={styles.version}>GymApp v1.0.0 · SDK 54</Text>
      </View>

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
  weightText: { fontSize: 14, color: Colors.textSecondary },
  statsSection: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 14, alignItems: 'center', borderTopWidth: 3 },
  statNumber: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  menuSection: { paddingHorizontal: 20, paddingBottom: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: Colors.border },
  menuEmoji: { fontSize: 24, marginRight: 14 },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  menuSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  menuArrow: { fontSize: 22, color: Colors.textMuted },
  logoutSection: { padding: 20, alignItems: 'center' },
  logoutBtn: { width: '100%', backgroundColor: Colors.error + '22', borderWidth: 1, borderColor: Colors.error, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 16 },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 16 },
  version: { fontSize: 12, color: Colors.textMuted },
});