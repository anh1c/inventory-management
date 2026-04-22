import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconServer } from '@tabler/icons-react';

import { ColorToggle } from '../items/ColorToggle';
import { LanguageToggle } from '../items/LanguageToggle';

export function AuthFormOptions({
  hostname,
  toggleHostEdit
}: Readonly<{
  hostname: string;
  toggleHostEdit: () => void;
}>) {
  return (
    <Group gap='xs' wrap='nowrap'>
      <ColorToggle />
      <LanguageToggle />
      {window.INVENTREE_SETTINGS.show_server_selector && (
        <Tooltip label={hostname}>
          <ActionIcon size='lg' variant='transparent' onClick={toggleHostEdit}>
            <IconServer />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
