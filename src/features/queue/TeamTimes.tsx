import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Avatar, ListRow, SectionHeader } from '@/ui';

import { useBusyTimes, type Employee } from './api';
import { busyByPerson } from './busyRanges';

/**
 * A stylist's My bookings (owner's fix list, 16 Nov): the other people's times for the day as busy or free, with no
 * client names, so the stylist can see who is free without reading anyone else's bookings.
 */
export function TeamTimes({ date, people }: { date: string; people: Employee[] }) {
  const { t } = useTranslation();
  const dates = useDates();
  const { business, branch, employeeId } = useWorkspace();
  const others = people.filter((p) => p.id !== employeeId);
  const busy = useBusyTimes(branch.id, date, others.length > 0);
  if (others.length === 0 || !busy.data) return null;
  const ranges = busyByPerson(busy.data, employeeId);
  const time = (ms: number) => dates.at(ms, business.timezone, 'HH:mm');

  return (
    <View style={styles.block} testID="team-times">
      <SectionHeader title={t('queue.team.title')} />
      {others.map((person) => {
        const mine = ranges.get(person.id) ?? [];
        return (
          <ListRow
            key={person.id}
            testID={`team-times-${person.full_name}`}
            leading={<Avatar name={person.full_name} size={36} />}
            title={person.full_name}
            titleLines={1}
            meta={[
              mine.length
                ? t('queue.team.busy', { times: mine.map((r) => `${time(r.start)}–${time(r.end)}`).join(', ') })
                : t('queue.team.free'),
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
});
