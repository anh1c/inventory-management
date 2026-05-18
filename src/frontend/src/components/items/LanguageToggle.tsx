import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { IconCheck, IconLanguage } from '@tabler/icons-react';

import { t } from '@lingui/core/macro';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  defaultLocale,
  getSupportedLanguages
} from '../../contexts/LanguageContext';
import { useLocalState } from '../../states/LocalState';

export function LanguageToggle() {
  const [locale, setLanguage] = useLocalState(
    useShallow((state) => [state.language, state.setLanguage])
  );

  const activeLocale = locale || defaultLocale;
  const languageOptions = useMemo(() => {
    const languages = getSupportedLanguages(activeLocale);

    return Object.keys(languages).map((key) => ({
      value: key,
      label: languages[key]
    }));
  }, [activeLocale]);

  return (
    <Menu position='bottom-end' width={170} shadow='md' withinPortal>
      <Menu.Target>
        <Tooltip label={t`Select language`}>
          <ActionIcon
            size='lg'
            variant='subtle'
            aria-label={t`Select language`}
          >
            <IconLanguage />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t`Language`}</Menu.Label>
        {languageOptions.map((option) => (
          <Menu.Item
            key={option.value}
            leftSection={
              activeLocale === option.value ? <IconCheck size={16} /> : null
            }
            onClick={() => setLanguage(option.value)}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
