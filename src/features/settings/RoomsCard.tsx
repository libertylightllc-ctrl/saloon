import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing } from '@/theme';
import { Button, Card, FormError, QueryState, Text, TextField, useToast } from '@/ui';

import { useBranchRooms, useSaveRoom, type Room } from './rooms';

/**
 * Branch settings → Rooms (2026-10-24), for the types that book rooms (ladies salons, beauty & wellness studios): the
 * treatment rooms a massage or a facial needs. Add, rename, stop or start using; saved at once.
 */
export function RoomsCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { branch } = useWorkspace();
  const rooms = useBranchRooms(branch.id);
  const save = useSaveRoom(branch.id);
  const [name, setName] = useState('');

  return (
    <Card variant="outlined" style={styles.card} testID="rooms">
      <Text variant="small" color="textSecondary">
        {t('branch.rooms.hint')}
      </Text>
      <QueryState query={rooms}>
        {(list) => (
          <View style={styles.list}>
            {list.map((room) => (
              <RoomRow key={room.id} room={room} branchId={branch.id} />
            ))}
          </View>
        )}
      </QueryState>
      <View style={styles.add}>
        <View style={styles.flex}>
          <TextField label={t('branch.rooms.new')} value={name} onChangeText={setName} maxLength={40} placeholder={t('branch.rooms.placeholder')} testID="room-new-name" />
        </View>
        <Button
          label={t('branch.rooms.add')}
          icon="plus"
          size="md"
          disabled={!name.trim()}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { room: null, name },
              {
                onSuccess: () => {
                  setName('');
                  toast(t('branch.rooms.added'));
                },
              },
            )
          }
          testID="room-add"
        />
      </View>
      <FormError error={save.error} />
    </Card>
  );
}

function RoomRow({ room, branchId }: { room: Room; branchId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveRoom(branchId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(room.name);

  if (editing) {
    return (
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label={t('branch.rooms.name')} value={name} onChangeText={setName} maxLength={40} testID={`room-name-${room.name}`} />
        </View>
        <Button
          label={t('common.save')}
          size="md"
          disabled={!name.trim()}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { room: room.id, name, active: room.active },
              {
                onSuccess: () => {
                  setEditing(false);
                  toast(t('branch.rooms.saved'));
                },
              },
            )
          }
          testID={`room-save-${room.name}`}
        />
        <FormError error={save.error} />
      </View>
    );
  }
  return (
    <View style={styles.row} testID={`room-${room.name}`}>
      <View style={styles.flex}>
        <Text variant="bodyStrong" color={room.active ? 'text' : 'textSecondary'}>
          {room.name}
        </Text>
        {room.active ? null : (
          <Text variant="small" color="textSecondary">
            {t('branch.rooms.notInUse')}
          </Text>
        )}
      </View>
      <Button label={t('branch.rooms.rename')} variant="ghost" size="sm" onPress={() => setEditing(true)} testID={`room-rename-${room.name}`} />
      <Button
        label={t(room.active ? 'branch.rooms.stop' : 'branch.rooms.use')}
        variant="ghost"
        size="sm"
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { room: room.id, name: room.name, active: !room.active },
            { onSuccess: () => toast(t(room.active ? 'branch.rooms.stopped' : 'branch.rooms.inUse')) },
          )
        }
        testID={`room-toggle-${room.name}`}
      />
      {!editing ? <FormError error={save.error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  add: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1, minWidth: 140 },
});
