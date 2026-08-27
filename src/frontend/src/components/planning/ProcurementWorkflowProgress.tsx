import { t } from '@lingui/core/macro';
import {
  Badge,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon
} from '@mantine/core';
import {
  IconBuildingWarehouse,
  IconCheck,
  IconFileUpload,
  IconShoppingCart,
  IconUserCheck
} from '@tabler/icons-react';

const procurementStages = [
  { value: 'proposal', label: () => t`Proposal`, icon: IconFileUpload },
  { value: 'assignment', label: () => t`Assignment`, icon: IconUserCheck },
  {
    value: 'warehouse_review',
    label: () => t`Warehouse Review`,
    icon: IconBuildingWarehouse
  },
  {
    value: 'purchasing',
    label: () => t`Purchasing and Sales`,
    icon: IconShoppingCart
  },
  { value: 'done', label: () => t`Completed`, icon: IconCheck }
];

export function ProcurementWorkflowProgress({ ticket }: Readonly<{ ticket: any }>) {
  const activeIndex = Math.max(
    0,
    procurementStages.findIndex((stage) => stage.value === ticket.status)
  );
  const items = ticket.procurement_subtasks ?? [];
  const waiting = items.filter((item: any) => item.status === 'waiting_approval').length;
  const pending = items.filter((item: any) => item.status === 'pending').length;
  const completed = items.filter((item: any) => item.status === 'done').length;

  return (
    <Stack gap='xs' px='xs' py={6}>
      <Group justify='space-between' gap='xs'>
        <Text fw={600} size='sm'>
          {t`Procurement Workflow`}
        </Text>
        <Group gap={6}>
          <Badge variant='light' color='yellow'>
            {t`Waiting Approval`}: {waiting}
          </Badge>
          <Badge variant='light' color='blue'>
            {t`Not Started`}: {pending}
          </Badge>
          <Badge variant='light' color='green'>
            {t`Completed`}: {completed}
          </Badge>
        </Group>
      </Group>

      <Progress
        value={(activeIndex / (procurementStages.length - 1)) * 100}
        size='sm'
        radius='xs'
      />

      <SimpleGrid cols={{ base: 2, sm: 5 }} spacing='xs'>
        {procurementStages.map((stage, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          const StageIcon = stage.icon;

          return (
            <Group key={stage.value} gap={6} wrap='nowrap'>
              <ThemeIcon
                size={26}
                radius='xs'
                variant={active ? 'filled' : complete ? 'light' : 'default'}
                color={complete ? 'green' : 'blue'}
              >
                <StageIcon size={16} />
              </ThemeIcon>
              <Text size='xs' fw={active ? 700 : 500} c={active ? undefined : 'dimmed'}>
                {stage.label()}
              </Text>
            </Group>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
