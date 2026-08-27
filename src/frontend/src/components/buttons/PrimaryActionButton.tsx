import { Button, Tooltip } from '@mantine/core';

import type { InvenTreeIconType } from '@lib/types/Icons';
import { InvenTreeIcon } from '../../functions/icons';

/**
 * A "primary action" button for display on a page detail, (for example)
 */
export default function PrimaryActionButton({
  title,
  tooltip,
  icon,
  color,
  variant = 'light',
  hidden,
  onClick
}: Readonly<{
  title: string;
  tooltip?: string;
  icon?: keyof InvenTreeIconType;
  color?: string;
  variant?: 'filled' | 'light' | 'outline' | 'subtle' | 'default';
  hidden?: boolean;
  onClick: () => void;
}>) {
  if (hidden) {
    return null;
  }

  return (
    <Tooltip label={tooltip ?? title} position='bottom' hidden={!tooltip}>
      <Button
        leftSection={icon && <InvenTreeIcon icon={icon} />}
        color={color}
        variant={variant}
        size='xs'
        radius='xs'
        h={34}
        px='sm'
        onClick={onClick}
      >
        {title}
      </Button>
    </Tooltip>
  );
}
