import {
  ActionIcon,
  type FloatingPosition,
  Group,
  Tooltip
} from '@mantine/core';
import type { ReactNode } from 'react';

import { identifierString } from '../functions/Conversion';

export type ActionButtonProps = {
  icon?: ReactNode;
  text?: string;
  color?: string;
  tooltip?: string;
  variant?: string;
  size?: number | string;
  radius?: number | string;
  disabled?: boolean;
  onClick: (event?: any) => void;
  hidden?: boolean;
  tooltipAlignment?: FloatingPosition;
};

/**
 * Construct a simple action button with consistent styling
 */
export function ActionButton(props: ActionButtonProps) {
  const hidden = props.hidden ?? false;

  return (
    !hidden && (
      <Tooltip
        key={`tooltip-${props.tooltip ?? props.text}`}
        disabled={!props.tooltip && !props.text}
        label={props.tooltip ?? props.text}
        position={props.tooltipAlignment ?? 'left'}
      >
        <ActionIcon
          key={`action-icon-${props.tooltip ?? props.text}`}
          disabled={props.disabled}
          p={0}
          radius={props.radius ?? 'xs'}
          color={props.color}
          size={props.size ?? 34}
          aria-label={`action-button-${identifierString(
            props.tooltip ?? props.text ?? ''
          )}`}
          onClick={(event: any) => {
            props.onClick(event);
          }}
          variant={props.variant ?? 'subtle'}
        >
          <Group gap='xs' wrap='nowrap'>
            {props.icon}
          </Group>
        </ActionIcon>
      </Tooltip>
    )
  );
}
