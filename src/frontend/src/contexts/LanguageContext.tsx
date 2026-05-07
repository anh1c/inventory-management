import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { LoadingOverlay, Text } from '@mantine/core';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useStoredTableState } from '@lib/states/StoredTableState';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../App';
import { useLocalState } from '../states/LocalState';
import { useServerApiState } from '../states/ServerApiState';
import { fetchGlobalStates } from '../states/states';

export const defaultLocale = 'vi';

/*
 * Function which returns a record of supported languages.
 * Note that this is not a constant, as it is used in the LanguageSelect component
 */
export const getSupportedLanguages = (
  locale: string | null = i18n.locale
): Record<string, string> => {
  const vietnameseLabels = (locale ?? defaultLocale).startsWith('vi');

  return vietnameseLabels
    ? {
        vi: 'Tiếng Việt',
        en: 'Tiếng Anh'
      }
    : {
        vi: 'Vietnamese',
        en: 'English'
      };
};

export function LanguageContext({
  children
}: Readonly<{ children: JSX.Element }>) {
  const [language] = useLocalState(useShallow((state) => [state.language]));
  const [server] = useServerApiState(useShallow((state) => [state.server]));

  const [activeLocale, setActiveLocale] = useState<string | null>(null);

  useEffect(() => {
    // Update the locale based on prioritization:
    // 1. Locally selected locale
    // 2. Server default locale
    // 3. English (fallback)

    let locale: string | null = activeLocale;

    if (!!language) {
      locale = language;
    } else if (!!server.default_locale) {
      locale = server.default_locale;
    } else {
      locale = defaultLocale;
    }

    if (locale != activeLocale) {
      setActiveLocale(locale);
      activateLocale(locale);
    }
  }, [activeLocale, language, server.default_locale, defaultLocale]);

  const [loadedState, setLoadedState] = useState<
    'loading' | 'loaded' | 'error'
  >('loading');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    let lang: string = language || server.default_locale || defaultLocale;

    // Ensure that the selected language is supported
    if (!Object.keys(getSupportedLanguages()).includes(lang)) {
      lang = defaultLocale;
    }

    activateLocale(lang)
      .then(() => {
        if (isMounted.current) setLoadedState('loaded');

        /*
         * Configure the default Accept-Language header for all requests.
         * - Locally selected locale
         * - Server default locale
         * - en (backup)
         */
        const locales: (string | undefined)[] = [];

        if (!!lang && lang != 'pseudo-LOCALE') {
          locales.push(lang);
        }

        if (!!server.default_locale) {
          locales.push(server.default_locale);
        }

        if (locales.indexOf('en') < 0) {
          locales.push('en');
        }

        // Ensure that the locales are properly formatted
        const new_locales = locales
          .map((locale) => locale?.replaceAll('_', '-').toLowerCase())
          .join(', ');

        if (new_locales == api.defaults.headers.common['Accept-Language']) {
          return;
        }

        // Update default Accept-Language headers
        api.defaults.headers.common['Accept-Language'] = new_locales;

        // Reload server state (and refresh status codes)
        fetchGlobalStates();

        // Clear out cached table column names
        useStoredTableState.getState().clearTableColumnNames();
      })
      /* istanbul ignore next */
      .catch((err) => {
        console.error('ERR: Failed loading translations', err);
        if (isMounted.current) setLoadedState('error');
      });

    return () => {
      isMounted.current = false;
    };
  }, [language, server.default_locale]);

  if (loadedState === 'loading') {
    return <LoadingOverlay visible={true} />;
  }

  /* istanbul ignore next */
  if (loadedState === 'error') {
    return (
      <Text>
        An error occurred while loading translations, see browser console for
        details.
      </Text>
    );
  }

  // only render the i18n Provider if the locales are fully activated, otherwise we end
  // up with an error in the browser console
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

// This function is used to determine the locale to activate based on the prioritization rules.
export function getPriorityLocale(): string {
  const serverDefault = useServerApiState.getState().server.default_locale;
  const userDefault = useLocalState.getState().language;

  return userDefault || serverDefault || defaultLocale;
}

export async function activateLocale(locale: string | null) {
  if (!locale) {
    locale = getPriorityLocale();
  }

  const localeDir = locale.split('-')[0]; // Extract the base locale (e.g., 'en' from 'en-US')
  const catalogLoaders = {
    vi: () => import('../locales/vi/messages'),
    en: () => import('../locales/en/messages')
  };
  const loadCatalog =
    catalogLoaders[localeDir as keyof typeof catalogLoaders] ??
    catalogLoaders[defaultLocale as keyof typeof catalogLoaders];

  try {
    const { messages } = await loadCatalog();
    i18n.load(locale, messages);
    i18n.activate(locale);
  } catch (err) {
    console.error(`Failed to load locale ${locale}:`, err);
  }
}
