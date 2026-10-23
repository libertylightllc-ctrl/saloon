/**
 * saloqo.com/b/<link>: a salon's booking page (owner, 2026-10-20). Anyone can open it — no account, no download: pick
 * services, who (or anyone), a day and a free time, then a name and phone number. In the salon's own look (Gents or
 * Ladies) and the visitor's language. The booking lands in the salon's queue at once.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { brand } from '@/config/brand';
import { dialCodeOf } from '@/lib/countries';
import { usePageMeta } from '@/lib/pageMeta';
import { isCurrency } from '@/lib/currencies';
import type { BusinessDate } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { spacing, ThemeProvider } from '@/theme';
import { Button, EmptyState, FormError, FormTextField, HeaderBand, QueryState, Screen, SectionHeader, Text } from '@/ui';

import { useBook, useBookingPage, useBookingSlots, type BookingPage } from './api';
import { DayChips, ServiceList, StaffChips, TimeGrid } from './BookingPickers';
import { SalonCard } from './SalonCard';

const schema = z.object({
  name: z.string().trim().min(2, 'validation.name').max(80, 'validation.tooLong'),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/, 'validation.phone'),
  notes: z.string().trim().max(300, 'validation.tooLong'),
});
type Details = z.infer<typeof schema>;

export function BookingScreen({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const page = useBookingPage(slug);
  return (
    <QueryState query={page}>
      {(p) =>
        p ? (
          <ThemeProvider mode={p.salon.mode}>
            <BookingForm slug={slug} page={p} />
          </ThemeProvider>
        ) : (
          <Screen header={<HeaderBand title={t('booking.title')} />}>
            <EmptyState illustration="no-results" message={t('booking.notFound')} />
          </Screen>
        )
      }
    </QueryState>
  );
}

function BookingForm({ slug, page }: { slug: string; page: BookingPage }) {
  const { t } = useTranslation();
  const s = page.salon;
  // "Book at Al Barsha Gents – Al Barsha": the branch says where, when it differs from the salon's name.
  usePageMeta(
    s.branch_name && s.branch_name !== s.business_name
      ? t('meta.booking.titleWhere', { salon: s.business_name, where: s.branch_name })
      : t('meta.booking.title', { salon: s.business_name }),
    t('meta.booking.description', { salon: s.business_name }),
  );
  const router = useRouter();
  const currency = isCurrency(page.salon.currency) ? page.salon.currency : 'AED';
  const [services, setServices] = useState<string[]>([]);
  const [staff, setStaff] = useState<string | null>(null);
  const [day, setDay] = useState<BusinessDate | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const slots = useBookingSlots(slug, day, services, staff);
  const book = useBook(slug);
  const form = useForm<Details>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: `+${dialCodeOf(page.salon.country_code)} `, notes: '' },
  });


  const chosen = page.services.filter((s) => services.includes(s.id));
  const total = sum(chosen.map((s) => s.price_minor));
  const minutes = sum(chosen.map((s) => s.duration_min ?? 0));
  // A different service, person or day: the time picked before may no longer be free.
  const toggle = (id: string) => {
    setTime(null);
    setServices((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  };
  const pickStaff = (id: string | null) => {
    setTime(null);
    setStaff(id);
  };
  const pickDay = (d: BusinessDate) => {
    setTime(null);
    setDay(d);
  };

  const submit = form.handleSubmit((v) =>
    time &&
    book.mutate(
      { service_ids: services, employee_id: staff, starts_at: time, name: v.name, phone: v.phone, notes: v.notes },
      { onSuccess: (r) => router.replace({ pathname: '/booking/[token]', params: { token: r.token } }) },
    ),
  );

  return (
    <Screen
      header={<HeaderBand title={t('booking.title')} subtitle={page.salon.business_name} />}
      footer={
        <View style={styles.footer}>
          {chosen.length ? (
            <Text color="textSecondary" testID="booking-summary">
              {[t('booking.servicesCount', { count: chosen.length }), minutes ? t('booking.minutes', { count: minutes }) : null, formatMoney(total, currency)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <Button label={t('booking.book')} onPress={submit} disabled={!time} loading={book.isPending} testID="booking-submit" />
        </View>
      }
    >
      <View style={styles.body}>
        <SalonCard salon={page.salon} />

        <View style={styles.section}>
          <SectionHeader title={t('booking.steps.services')} />
          {page.salon.tax_added ? (
            <Text variant="small" color="textSecondary">
              {t('booking.taxAdded', { tax: page.salon.tax_name })}
            </Text>
          ) : null}
          <ServiceList page={page} currency={currency} picked={services} onToggle={toggle} />
        </View>

        {page.staff.length ? (
          <View style={styles.section}>
            <SectionHeader title={t('booking.steps.staff')} />
            <StaffChips page={page} value={staff} onChange={pickStaff} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title={t('booking.steps.day')} />
          <DayChips page={page} value={day} onChange={pickDay} />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('booking.steps.time')} />
          {!services.length || !day ? (
            <Text color="textSecondary">{t('booking.pickFirst')}</Text>
          ) : (
            <QueryState query={slots}>
              {(list) =>
                list.length ? (
                  <TimeGrid slots={list} timeZone={page.salon.timezone} value={time} onChange={setTime} />
                ) : (
                  <Text color="textSecondary" testID="booking-no-times">
                    {t('booking.noTimes')}
                  </Text>
                )
              }
            </QueryState>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('booking.steps.details')} />
          <FormTextField control={form.control} name="name" label={t('booking.fields.name')} autoComplete="name" />
          <FormTextField
            control={form.control}
            name="phone"
            label={t('booking.fields.phone')}
            hint={t('booking.fields.phoneHint')}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <FormTextField control={form.control} name="notes" label={t('booking.fields.notes')} maxLength={300} />
        </View>
        <FormError error={book.error} />
        {/* Every booking page tells other salon owners where it comes from (website brief 5.1). */}
        <View style={styles.poweredBy}>
          <Button
            label={t('booking.poweredBy', { app: brand.appName })}
            variant="ghost"
            size="sm"
            href={`${brand.website}/?ref=booking&salon=${encodeURIComponent(slug)}`}
            external
            testID="booking-powered-by"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing['2xl'] },
  section: { gap: spacing.md },
  footer: { gap: spacing.sm },
  poweredBy: { alignItems: 'center' },
});
