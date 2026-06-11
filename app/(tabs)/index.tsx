import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';
import { useRouter } from 'expo-router';

const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

interface DayPlan {
  routine_name: string | null;
  routine_id: number | null;
}

interface DashStats {
  totalRoutines: number;
  totalExercises: number;
  todayKcal: number;
  weekSessions: number;
  lastWeight: number | null;
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [stats, setStats] = useState<DashStats>({ totalRoutines: 0, totalExercises: 0, todayKcal: 0, weekSessions: 0, lastWeight: null });
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>(Array(7).fill({ routine_name: null, routine_id: null }));
  const today = new Date().toISOString().split('T')[0];
  const todayDow = (new Date().getDay() + 6) % 7;

  const loadData = useCallback(() => {
    if (!user) return;
    const db = getDb();

    const routines = db.getFirstSync('SELECT COUNT(*) as c FROM routines WHERE user_id = ?', [user.id]) as { c: number };
    const exercises = db.getFirstSync('SELECT COUNT(*) as c FROM exercises e JOIN routines r ON e.routine_id = r.id WHERE r.user_id = ?', [user.id]) as { c: number };
    const kcal = db.getFirstSync(`SELECT COALESCE(SUM(calories),0) as c FROM nutrition_logs WHERE user_id = ? AND date(logged_at) = ?`, [user.id, today]) as { c: number };
    const lastWeight = db.getFirstSync('SELECT weight FROM body_stats WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1', [user.id]) as { weight: number } | null;

    setStats({
      totalRoutines: routines?.c || 0,
      totalExercises: exercises?.c || 0,
      todayKcal: Math.round(kcal?.c || 0),
      weekSessions: 0,
      lastWeight: lastWeight?.weight || null,
    });

    const plan: DayPlan[] = Array(7).fill(null).map((_, i) => {
      const row = db.getFirstSync(
        `SELECT r.name as routine_name, wp.routine_id FROM weekly_planner wp LEFT JOIN routines r ON wp.routine_id = r.id WHERE wp.user_id = ? AND wp.day_of_week = ?`,
        [user.id, i]
      ) as { routine_name: string; routine_id: number } | null;
      return { routine_name: row?.routine_name || null, routine_id: row?.routine_id || null };
    });
    setWeekPlan(plan);
  }, [user, today]);

  useEffect(() => { loadData(); }, [loadData]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos dias';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>

      {/* Hero */}
      <View style={styles.hero}>
        <View>
          <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>
            {weekPlan[todayDow]?.routine_name
              ? `Hoy toca: ${weekPlan[todayDow].routine_name} 💪`
              : 'Hoy es dia de descanso 😴'}
          </Text>
        </View>
        {user?.goal && (
          <View style={styles.goalChip}>
            <Text style={styles.goalChipText}>🎯 {user.goal}</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalRoutines}</Text>
          <Text style={styles.statLabel}>Rutinas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalExercises}</Text>
          <Text style={styles.statLabel}>Ejercicios</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.todayKcal}</Text>
          <Text style={styles.statLabel}>Kcal hoy</Text>
        </View>
        {stats.lastWeight && (
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.lastWeight}</Text>
            <Text style={styles.statLabel}>kg peso</Text>
          </View>
        )}
      </View>

      {/* Planner semanal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Esta semana</Text>
        <View style={styles.weekRow}>
          {DAYS.map((day, i) => (
            <View key={i} style={[styles.dayBox, i === todayDow && styles.dayBoxToday, weekPlan[i]?.routine_id && styles.dayBoxActive]}>
              <Text style={[styles.dayLabel, i === todayDow && styles.dayLabelToday]}>{day}</Text>
              <View style={[styles.dayDot, weekPlan[i]?.routine_id ? styles.dayDotActive : styles.dayDotRest, i === todayDow && styles.dayDotToday]} />
            </View>
          ))}
        </View>
      </View>

      {/* Acceso rapido */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acceso rapido</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.primary }]} onPress={() => router.push('/(tabs)/routines')}>
            <Text style={styles.cardEmoji}>💪</Text>
            <Text style={styles.cardTitle}>Rutinas</Text>
            <Text style={styles.cardSub}>{stats.totalRoutines} creadas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.secondary }]} onPress={() => router.push('/(tabs)/nutrition')}>
            <Text style={styles.cardEmoji}>🥗</Text>
            <Text style={styles.cardTitle}>Nutricion</Text>
            <Text style={styles.cardSub}>{stats.todayKcal} kcal hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.accent }]} onPress={() => router.push('/(tabs)/progress')}>
            <Text style={styles.cardEmoji}>📈</Text>
            <Text style={styles.cardTitle}>Progreso</Text>
            <Text style={styles.cardSub}>{stats.lastWeight ? stats.lastWeight + 'kg' : 'Sin datos'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.warning }]} onPress={() => router.push('/(tabs)/coach')}>
            <Text style={styles.cardEmoji}>🤖</Text>
            <Text style={styles.cardTitle}>AI Coach</Text>
            <Text style={styles.cardSub}>Consultar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Perfil incompleto */}
      {!user?.goal && (
        <TouchableOpacity style={styles.profileBanner} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.profileBannerText}>⚠️ Completa tu perfil para personalizar tu experiencia →</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { padding: 24, paddingTop: 28, backgroundColor: Colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  goalChip: { backgroundColor: Colors.primary + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary },
  goalChipText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBox: { alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 10, width: 44 },
  dayBoxToday: { backgroundColor: Colors.primary + '22', borderWidth: 1, borderColor: Colors.primary },
  dayBoxActive: { backgroundColor: Colors.card },
  dayLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  dayLabelToday: { color: Colors.primary },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayDotActive: { backgroundColor: Colors.primary },
  dayDotRest: { backgroundColor: Colors.border },
  dayDotToday: { backgroundColor: Colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47%', backgroundColor: Colors.card, borderRadius: 16, padding: 18, borderLeftWidth: 4 },
  cardEmoji: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  profileBanner: { marginHorizontal: 16, backgroundColor: Colors.warning + '22', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.warning },
  profileBannerText: { color: Colors.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});