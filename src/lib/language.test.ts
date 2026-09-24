import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import { i18n, isRtlLanguage } from './i18n';
import { bootstrapLanguage, changeLanguage, pickLanguage } from './language';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'en' }]) }));

/** The direction the running app started with (React Native reads it once at launch). */
function runningRtl(rtl: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { value: rtl, configurable: true });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
  jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
  runningRtl(false);
});

describe('pickLanguage', () => {
  it('prefers the stored choice', () => {
    expect(pickLanguage('ur', ['en'])).toBe('ur');
  });

  it('falls back to the first supported device language', () => {
    expect(pickLanguage(null, ['fr', 'ar', 'en'])).toBe('ar');
    expect(pickLanguage('xx', [null, 'hi'])).toBe('hi');
  });

  it('falls back to English', () => {
    expect(pickLanguage(null, ['fr', null])).toBe('en');
    expect(pickLanguage(null, [])).toBe('en');
  });
});

describe('isRtlLanguage', () => {
  it('marks Arabic and Urdu as right-to-left', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('ur')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
    expect(isRtlLanguage('hi')).toBe(false);
  });
});

describe('changeLanguage', () => {
  it('stores the choice, flips to RTL and reloads for Arabic', async () => {
    await changeLanguage('ar');
    expect(await AsyncStorage.getItem('settings.language')).toBe('ar');
    expect(i18n.language).toBe('ar');
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    expect(reloadAppAsync).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the direction stays the same', async () => {
    await changeLanguage('hi');
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    expect(reloadAppAsync).not.toHaveBeenCalled();

    runningRtl(true);
    await changeLanguage('ur');
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });
});

describe('bootstrapLanguage', () => {
  it('uses the device language on first launch', async () => {
    jest.mocked(getLocales).mockReturnValueOnce([{ languageCode: 'hi' }] as never);
    expect(await bootstrapLanguage()).toBe('hi');
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });

  it('reloads once when the running direction is wrong, never in a loop', async () => {
    await AsyncStorage.setItem('settings.language', 'ar');

    await bootstrapLanguage();
    expect(reloadAppAsync).toHaveBeenCalledTimes(1);

    // The device came back still LTR (e.g. it refuses RTL): carry on instead of reloading again.
    await bootstrapLanguage();
    expect(reloadAppAsync).toHaveBeenCalledTimes(1);
  });

  it('clears the reload marker once the direction is right', async () => {
    await AsyncStorage.setItem('settings.language', 'ar');
    await AsyncStorage.setItem('settings.directionReload', 'ar');
    runningRtl(true);

    await bootstrapLanguage();
    expect(reloadAppAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('settings.directionReload')).toBeNull();
  });
});

describe('RTL isolation of inserted values', () => {
  it('wraps values in Arabic and Urdu so Latin text and numbers keep their direction', async () => {
    await changeLanguage('ar');
    const text = i18n.t('sale.doneTitle', { number: '#1043' });
    expect(text).toContain('⁨#1043⁩');
    await changeLanguage('ur');
    expect(i18n.t('queue.startedAt', { time: '10:40' })).toContain('⁨10:40⁩');
  });

  it('leaves English and Hindi untouched', async () => {
    await changeLanguage('en');
    expect(i18n.t('sale.doneTitle', { number: '#1043' })).toBe('Sale #1043 saved');
    await changeLanguage('hi');
    expect(i18n.t('sale.doneTitle', { number: '#1043' })).not.toContain('⁨');
  });
});
