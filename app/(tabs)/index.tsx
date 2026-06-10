import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.greeting}>Hola, {user?.name} 👋</Text>
        <Text style={styles.subtitle}>Listo para entrenar hoy?</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Sesiones</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Ejercicios</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Kcal hoy</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Acceso rapido</Text>
      <View style={styles.grid}>
        <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.primary }]}>
          <Text style={styles.cardEmoji}>💪</Text>
          <Text style={styles.cardTitle}>Rutinas</Text>
          <Text style={styles.cardSub}>Ver mis rutinas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.secondary }]}>
          <Text style={styles.cardEmoji}>🥗</Text>
          <Text style={styles.cardTitle}>Nutricion</Text>
          <Text style={styles.cardSub}>Registrar comida</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.accent }]}>
          <Text style={styles.cardEmoji}>📈</Text>
          <Text style={styles.cardTitle}>Progreso</Text>
          <Text style={styles.cardSub}>Ver historial</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.card, { borderLeftColor: Colors.warning }]}>
          <Text style={styles.cardEmoji}>🤖</Text>
          <Text style={styles.cardTitle}>AI Coach</Text>
          <Text style={styles.cardSub}>Consultar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Planner semanal</Text>
      <View style={styles.planner}>
        {['L','M','X','J','V','S','D'].map((day, i) => (
          <View key={i} style={styles.dayBox}>
            <Text style={styles.dayLabel}>{day}</Text>
            <View style={styles.dayDot} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { padding: 24, paddingTop: 32, backgroundColor: Colors.surface, marginBottom: 16 },
  greeting: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 24, gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 16, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 24 },
  card: { width: '46%', margin: '2%', backgroundColor: Colors.card, borderRadius: 16, padding: 20, borderLeftWidth: 4 },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  planner: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 32, justifyContent: 'space-between' },
  dayBox: { alignItems: 'center', backgroundColor: Colors.card, borderRadius: 10, padding: 10, width: 40 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
});