/**
 * A booking page's title and description (owner's fix list D1), the same in the app and in the link preview the website
 * sends (api/_lib/bookingPreview.ts): "Book at Al Barsha Gents – Dubai" and "12 services · book online, no app needed".
 * No app imports here: the website's server function uses it too.
 */
export interface MetaSalon {
  business_name: string;
  branch_name: string;
  address: string | null;
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

/**
 * Where the salon is: the town at the end of its address ("Shop 4, Al Barsha 1, Dubai" → "Dubai"; an address without
 * commas is the town), else the branch's name when it differs from the salon's. Null when neither says more.
 */
export function bookingPlace(salon: MetaSalon): string | null {
  const town = salon.address?.split(',').map((part) => part.trim()).filter(Boolean).pop();
  if (town && town.length <= 40 && town !== salon.business_name) return town;
  return salon.branch_name && salon.branch_name !== salon.business_name ? salon.branch_name : null;
}

export function bookingMeta(salon: MetaSalon, services: number, t: Translate): { title: string; description: string } {
  const where = bookingPlace(salon);
  return {
    title: where
      ? t('meta.booking.titleWhere', { salon: salon.business_name, where })
      : t('meta.booking.title', { salon: salon.business_name }),
    description:
      services > 0 ? t('meta.booking.services', { count: services }) : t('meta.booking.description', { salon: salon.business_name }),
  };
}
