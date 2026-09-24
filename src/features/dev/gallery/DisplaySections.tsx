import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { demoBranches } from '@/features/demo/data';
import { modeConfig } from '@/features/mode/modeConfig';
import { useTerms } from '@/features/mode/useTerms';
import { businessDate, monthKey, shiftBusinessDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useThemeMode } from '@/theme';
import {
  Avatar,
  BottomSheet,
  Button,
  CategoryCircle,
  DateStrip,
  EmptyState,
  Illustration,
  KpiCard,
  ListRow,
  MenuRow,
  MonthSwitcher,
  ProgressDashes,
  PromoBanner,
  Skeleton,
  STATUS_TONE,
  StatusPill,
  Stepper,
  Thumb,
  TimeSlotGrid,
  useToast,
  type IllustrationName,
  type StatusKey,
} from '@/ui';

import { galleryStyles, Section } from './Section';

export function CardSection() {
  const { t } = useTranslation();
  const terms = useTerms();
  const [qty, setQty] = useState(1);
  return (
    <Section title={t('gallery.sections.cards')}>
      <KpiCard
        hero
        icon="banknote"
        label={t('home.expectedCash')}
        value={formatMoney(124000)}
        delta={{ label: '12%', trend: 'up' }}
        sub={t('home.vsYesterday')}
        action={<Button label={t('home.closeDay')} size="sm" />}
      />
      <View style={galleryStyles.row}>
        <KpiCard
          icon="receipt"
          label={t('home.salesToday')}
          value={formatMoney(186000)}
          delta={{ label: '4%', trend: 'down' }}
        />
        <KpiCard
          icon="wallet"
          label={t('home.moneyOut')}
          value={formatMoney(31000)}
          sub={t('gallery.moneyOutSub')}
        />
      </View>
      <ListRow
        title="Haircut"
        leading={<Thumb icon="scissors" />}
        meta={['Neck strip 1', { icon: 'clock', text: t('common.minutes', { n: 30 }) }]}
        trailing={<Stepper value={qty} onChange={setQty} itemLabel="Haircut" />}
      />
      <ListRow
        title="Ahmed Khan"
        leading={<Avatar name="Ahmed Khan" size={44} />}
        meta={[{ icon: 'mapPin', text: `${terms.station} 2 · Rafiq` }]}
        badges={<StatusPill tone="warning" label={t('queue.badges.patch_test')} />}
        trailing={<StatusPill status="waiting" />}
        chevron
        onPress={() => {}}
      />
      <View>
        <MenuRow icon="user" label={t('gallery.myProfile')} index={0} />
        <MenuRow icon="receipt" label={t('gallery.bookingHistory')} index={1} value="12" />
        <MenuRow icon="bell" label={t('common.notifications')} index={3} />
        <MenuRow icon="logOut" label={t('more.logOut')} danger last />
      </View>
    </Section>
  );
}

export function IdentitySection() {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  return (
    <Section title={t('gallery.sections.identity')}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={galleryStyles.row}
      >
        {modeConfig[mode].defaultCategories.map((c, i) => (
          <CategoryCircle
            key={c.key}
            icon={c.icon}
            index={i}
            label={t(`categories.${c.key}` as 'categories.hair')}
            selected={i === 0}
          />
        ))}
      </ScrollView>
      <View style={galleryStyles.row}>
        {(Object.keys(STATUS_TONE) as StatusKey[]).map((status) => (
          <StatusPill key={status} status={status} />
        ))}
      </View>
      <View style={galleryStyles.row}>
        <Avatar name="Rafiq Hussain" size={56} />
        {demoBranches.gents.staff.map((person) => (
          <Avatar key={person.id} name={person.name} color={person.colour} />
        ))}
        <Avatar name="فاطمة" />
        <Avatar name="Priya Nair" size={32} />
      </View>
    </Section>
  );
}

export function BannerSection() {
  const { t } = useTranslation();
  return (
    <Section title={t('gallery.sections.banners')}>
      <PromoBanner
        title={t('home.setup.title')}
        body={t('home.setup.body', { done: 4, total: 6 })}
        actionLabel={t('home.setup.action')}
        progress={{ done: 4, total: 6 }}
        illustration="promo-setup"
      />
      <ProgressDashes total={3} current={0} />
      <ProgressDashes total={6} current={4} mode="progress" />
    </Section>
  );
}

export function DateSection() {
  const { t } = useTranslation();
  const today = businessDate();
  const [month, setMonth] = useState(monthKey(today));
  const [date, setDate] = useState(today);
  const [time, setTime] = useState<string | undefined>('11:30');
  const dates = Array.from({ length: 10 }, (_, i) => shiftBusinessDate(today, i));
  const slots = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'].map(
    (slot, i) => ({
      time: slot,
      available: i !== 2 && i !== 5,
    }),
  );
  return (
    <Section title={t('gallery.sections.dates')}>
      <MonthSwitcher value={month} onChange={setMonth} />
      <DateStrip dates={dates} value={date} onChange={setDate} />
      <TimeSlotGrid slots={slots} value={time} onChange={setTime} />
    </Section>
  );
}

const ILLUSTRATIONS: IllustrationName[] = [
  'onboarding-1',
  'queue-empty',
  'stock-ok',
  'compliance-ok',
  'sale-done',
  'no-results',
];

export function FeedbackSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <Section title={t('gallery.sections.feedback')}>
      <View style={galleryStyles.row}>
        <Button
          label={t('gallery.openSheet')}
          variant="secondary"
          size="md"
          onPress={() => setOpen(true)}
        />
        <Button
          label={t('gallery.showToast')}
          variant="outline"
          size="md"
          onPress={() => toast(t('sale.saved'))}
        />
      </View>
      <EmptyState
        illustration="queue-empty"
        message={t('queue.empty')}
        actionLabel={t('queue.addWalkIn')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={galleryStyles.row}
      >
        {ILLUSTRATIONS.map((name) => (
          <Illustration key={name} name={name} size={96} />
        ))}
      </ScrollView>
      <View style={galleryStyles.column}>
        <Skeleton height={20} width="60%" />
        <Skeleton height={56} />
      </View>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('gallery.sheetTitle')}>
        <Button label={t('common.done')} onPress={() => setOpen(false)} />
      </BottomSheet>
    </Section>
  );
}
