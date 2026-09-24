import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { HeaderBand, MonthSwitcher, Screen, SearchBar, SegmentTabs } from '@/ui';

import { ButtonSection, InputSection, TabsSection } from './ControlSections';
import {
  BannerSection,
  CardSection,
  DateSection,
  FeedbackSection,
  IdentitySection,
} from './DisplaySections';
import { ColourSection, TypeSection } from './FoundationSections';

/** Every component in the current look. Flip gents/ladies and LTR/RTL in the dev strip. */
export function GalleryScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('about');
  const [month, setMonth] = useState('2026-09');

  return (
    <Screen
      header={
        <HeaderBand title={t('gallery.title')} subtitle={t('gallery.subtitle')} onBack>
          <SearchBar placeholder={t('common.search')} onFilter={() => {}} />
          <SegmentTabs
            items={[
              { key: 'about', label: t('gallery.tabs.about') },
              { key: 'services', label: t('gallery.tabs.services') },
              { key: 'gallery', label: t('gallery.tabs.gallery') },
              { key: 'reviews', label: t('gallery.tabs.reviews') },
            ]}
            value={tab}
            onChange={setTab}
          />
          <MonthSwitcher value={month} onChange={setMonth} />
        </HeaderBand>
      }
    >
      <View style={styles.sections}>
        <ColourSection />
        <TypeSection />
        <ButtonSection />
        <InputSection />
        <TabsSection />
        <CardSection />
        <IdentitySection />
        <BannerSection />
        <DateSection />
        <FeedbackSection />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing['2xl'] },
});
