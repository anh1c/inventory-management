import { Stack, Text } from '@mantine/core';
import { IconCalendar, IconTable, IconTicket } from '@tabler/icons-react';
import { useLocalStorage } from '@mantine/hooks';
import { useState } from 'react';

import WorkTicketCalendar from '../../components/calendar/WorkTicketCalendar';
import { PageDetail } from '../../components/nav/PageDetail';
import { PanelGroup } from '../../components/panels/PanelGroup';
import SegmentedControlPanel from '../../components/panels/SegmentedControlPanel';
import WorkTicketTable from '../../tables/planning/WorkTicketTable';
import WorkPlanTable from '../../tables/planning/WorkPlanTable';
import { t } from '@lingui/core/macro';

export default function WorkTicketsIndex() {
  const [view, setView] = useLocalStorage<string>({ key: 'work-ticket-view', defaultValue: 'table' });
  const [selectedPlan, setSelectedPlan] = useState<any>();

  return (
    <Stack gap='sm'>
      <PageDetail
        title={t`Work Plans`}
        subtitle={t`Plan work, assign tasks and track project progress`}
        icon={<IconTicket size={18} />}
      />
      <PanelGroup
        pageKey='work-tickets'
        panels={[
          {
            name: 'plans',
            label: t`Work Plans`,
            icon: <IconTable />,
            content: <WorkPlanTable onSelectPlan={setSelectedPlan} />
          },
          SegmentedControlPanel({
            name: 'tickets',
            label: t`Work Management`,
            icon: <IconTicket />,
            selection: view,
            onChange: setView,
            options: [
              {
                value: 'table',
                label: t`Work Tickets`,
                icon: <IconTicket />,
                content: (
                  <Stack gap='xs'>
                    {selectedPlan && <Text fw={600}>{selectedPlan.code}: {selectedPlan.name}</Text>}
                    <WorkTicketTable planId={selectedPlan?.pk} projectCodeId={selectedPlan?.project_code} />
                  </Stack>
                )
              },
              {
                value: 'calendar',
                label: t`Calendar`,
                icon: <IconCalendar />,
                content: (
                  <Stack gap='xs'>
                    {selectedPlan && <Text fw={600}>{selectedPlan.code}: {selectedPlan.name}</Text>}
                    <WorkTicketCalendar planId={selectedPlan?.pk} />
                  </Stack>
                )
              }
            ]
          })
        ]}
      />
    </Stack>
  );
}
