import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Minor } from '@/lib/money';
import {
  Button,
  IconButton,
  MoneyInput,
  SearchBar,
  SegmentTabs,
  Stepper,
  TextField,
  type ButtonVariant,
} from '@/ui';

import { galleryStyles, Section } from './Section';

const VARIANTS = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
] as const satisfies readonly ButtonVariant[];

export function ButtonSection() {
  const { t } = useTranslation();
  return (
    <Section title={t('gallery.sections.buttons')}>
      <Button label={t('gallery.saveSale')} icon="receipt" />
      <Button label={t('gallery.saving')} loading />
      <Button label={t('gallery.disabled')} disabled />
      {VARIANTS.map((variant) => (
        <View key={variant} style={galleryStyles.row}>
          <Button label={t(`gallery.variants.${variant}`)} variant={variant} size="md" />
          <Button label={t('gallery.bookNow')} variant={variant} size="sm" />
        </View>
      ))}
      <View style={galleryStyles.row}>
        <IconButton icon="bell" badge={3} accessibilityLabel={t('common.notifications')} />
        <IconButton icon="search" variant="tinted" accessibilityLabel={t('common.search')} />
        <IconButton icon="sliders" variant="filled" accessibilityLabel={t('common.filter')} />
        <IconButton icon="ellipsis" variant="plain" accessibilityLabel={t('common.more')} />
        <IconButton icon="bell" badge accessibilityLabel={t('common.notifications')} />
      </View>
    </Section>
  );
}

export function InputSection() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<Minor | null>(4500);
  const [search, setSearch] = useState('');
  return (
    <Section title={t('gallery.sections.inputs')}>
      <SearchBar value={search} onChangeText={setSearch} onFilter={() => {}} />
      <TextField
        label={t('gallery.fullName')}
        placeholder={t('gallery.fullNamePlaceholder')}
        value={name}
        onChangeText={setName}
      />
      <TextField
        label={t('gallery.phone')}
        value="050 123"
        error={t('gallery.phoneError')}
        keyboardType="phone-pad"
      />
      <MoneyInput
        label={t('gallery.cashCounted')}
        value={amount}
        onChange={setAmount}
        hint={t('gallery.cashHint')}
      />
    </Section>
  );
}

export function TabsSection() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('popular');
  const [qty, setQty] = useState(0);
  const [qty2, setQty2] = useState(2);
  return (
    <Section title={t('gallery.sections.tabs')}>
      <SegmentTabs
        items={[
          { key: 'popular', label: t('gallery.tabs.popular') },
          { key: 'hair', label: t('categories.hair') },
          { key: 'color', label: t('categories.color') },
          { key: 'facial', label: t('categories.facial') },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={galleryStyles.row}>
        <Stepper value={qty} onChange={setQty} itemLabel={t('gallery.sampleService')} />
        <Stepper value={qty2} onChange={setQty2} itemLabel={t('gallery.sampleService')} />
      </View>
    </Section>
  );
}
