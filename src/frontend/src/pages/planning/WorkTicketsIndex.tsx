import { Stack } from '@mantine/core';
import { IconCalendar, IconTable, IconTicket } from '@tabler/icons-react';
import { useLocalStorage } from '@mantine/hooks';

import WorkTicketCalendar from '../../components/calendar/WorkTicketCalendar';
import { PageDetail } from '../../components/nav/PageDetail';
import { PanelGroup } from '../../components/panels/PanelGroup';
import SegmentedControlPanel from '../../components/panels/SegmentedControlPanel';
import WorkTicketTable from '../../tables/planning/WorkTicketTable';
import WorkPlanTable from '../../tables/planning/WorkPlanTable';
import { t } from '@lingui/core/macro';

export default function WorkTicketsIndex() {
  const [view, setView] = useLocalStorage<string>({ key: 'planning-view', defaultValue: 'plans' });

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
          SegmentedControlPanel({
            name: 'index',
            label: t`Planning`,
            icon: <IconTicket />,
            selection: view,
            onChange: setView,
            options: [
              { value: 'plans', label: t`Work Plans`, icon: <IconTable />, content: <WorkPlanTable /> },
              { value: 'tasks', label: t`Work Tickets`, icon: <IconTicket />, content: <WorkTicketTable /> },
              { value: 'calendar', label: t`Calendar`, icon: <IconCalendar />, content: <WorkTicketCalendar /> }
            ]
          })
        ]}
      />
    </Stack>
  );
}
