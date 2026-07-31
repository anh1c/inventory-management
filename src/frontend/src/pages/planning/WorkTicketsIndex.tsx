import { Stack } from '@mantine/core';
import { IconCalendar, IconTable, IconTicket } from '@tabler/icons-react';
import { useLocalStorage } from '@mantine/hooks';

import WorkTicketCalendar from '../../components/calendar/WorkTicketCalendar';
import { PageDetail } from '../../components/nav/PageDetail';
import { PanelGroup } from '../../components/panels/PanelGroup';
import SegmentedControlPanel from '../../components/panels/SegmentedControlPanel';
import WorkTicketTable from '../../tables/planning/WorkTicketTable';

export default function WorkTicketsIndex() {
  const [view, setView] = useLocalStorage<string>({ key: 'work-ticket-view', defaultValue: 'table' });

  return (
    <Stack gap='sm'>
      <PageDetail
        title='Kế hoạch'
        subtitle='Giao việc và theo dõi tiến độ theo mã dự án'
        icon={<IconTicket size={18} />}
      />
      <PanelGroup
        pageKey='work-tickets'
        panels={[
          SegmentedControlPanel({
            name: 'index',
            label: 'Công việc',
            icon: <IconTicket />,
            selection: view,
            onChange: setView,
            options: [
              { value: 'table', label: 'Bảng', icon: <IconTable />, content: <WorkTicketTable /> },
              { value: 'calendar', label: 'Lịch', icon: <IconCalendar />, content: <WorkTicketCalendar /> }
            ]
          })
        ]}
      />
    </Stack>
  );
}
