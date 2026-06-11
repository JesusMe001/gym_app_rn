import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

interface Invitation {
  id: number;
  trainer_name: string;
  trainer_username: string;
  created_at: string;
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const loadInvitations = useCallback(() => {
    if (!user) return;
    const rows = getDb().getAllSync(`
      SELECT i.id, u.name as trainer_name, u.username as trainer_username, i.created_at
      FROM invitations i JOIN users u ON i.trainer_id = u.id
      WHERE i.client_id = ? AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `, [user.id]) as Invitation[];
    setInvitations(rows);
  }, [user]);

  useEffect(() => { loadInvitations(); }, [loadInvitations]);

  const acceptInvitation = (inv: Invitation) => {
    Alert.alert('Aceptar invitacion', `Quieres unirte al equipo de ${inv.trainer_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => {
        const db = getDb();
        db.runSync('UPDATE invitations SET status = ? WHERE id = ?', ['accepted', inv.id]);
        const trainer = db.getFirstSync('SELECT id FROM users WHERE username = ?', [inv.trainer_username]) as { id: number };
        if (trainer) {
          const existing = db.getFirstSync('SELECT id FROM trainer_clients WHERE trainer_id = ? AND client_id = ?', [trainer.id, user!.id]);
          if (!existing) {
            db.runSync('INSERT INTO trainer_clients (trainer_id, client_id, status) VALUES (?, ?, ?)', [trainer.id, user!.id, 'active']);
          } else {
            db.runSync('UPDATE trainer_clients SET status = ? WHERE trainer_id = ? AND client_id = ?', ['active', trainer.id, user!.id]);
          }
        }
        loadInvitations();
        Alert.alert('Bienvenido!', `Ahora eres cliente de ${inv.trainer_name}. Podra ver tu progreso y asignarte rutinas.`);
      }}
    ]);
  };

  const rejectInvitation = (inv: Invitation) => {
    Alert.alert('Rechazar', `Seguro que quieres rechazar la invitacion de ${inv.trainer_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Rechazar', style: 'destructive', onPress: () => {
        getDb().runSync('UPDATE invitations SET status = ? WHERE id = ?', ['rejected', inv.id]);
        loadInvitations();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        {invitations.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{invitations.length}</Text></View>}
      </View>

      {invitations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptySub}>Las invitaciones de entrenadores apareceran aqui</Text>
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.invCard}>
              <View style={styles.invAvatar}>
                <Text style={styles.invAvatarText}>{item.trainer_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.invInfo}>
                <Text style={styles.invTitle}>Invitacion de entrenador</Text>
                <Text style={styles.invName}>{item.trainer_name}</Text>
                <Text style={styles.invUsername}>@{item.trainer_username}</Text>
                <Text style={styles.invDate}>{new Date(item.created_at).toLocaleDateString('es-ES')}</Text>
                <View style={styles.invActions}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptInvitation(item)}>
                    <Text style={styles.acceptBtnText}>✓ Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectInvitation(item)}>
                    <Text style={styles.rejectBtnText}>✗ Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: Colors.surface, gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  badge: { backgroundColor: Colors.error, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  invCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', borderLeftWidth: 4, borderLeftColor: Colors.warning },
  invAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.warning, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  invAvatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  invInfo: { flex: 1 },
  invTitle: { fontSize: 12, color: Colors.warning, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  invName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  invUsername: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  invDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  invActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: Colors.secondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectBtn: { flex: 1, backgroundColor: Colors.error + '22', borderWidth: 1, borderColor: Colors.error, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  rejectBtnText: { color: Colors.error, fontWeight: '700', fontSize: 14 },
});