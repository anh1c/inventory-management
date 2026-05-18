import { t } from '@lingui/core/macro';
import { Alert, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconListDetails } from '@tabler/icons-react';

import { UserRoles } from '@lib/enums/Roles';
import PermissionDenied from '../../components/errors/PermissionDenied';
import { PageDetail } from '../../components/nav/PageDetail';
import { GlobalSettingList } from '../../components/settings/SettingList';
import { useUserState } from '../../states/UserState';
import ProjectCodeTable from '../../tables/settings/ProjectCodeTable';

export default function ProjectsIndex() {
  const user = useUserState();

  if (!user.isLoggedIn() || !user.hasViewRole(UserRoles.admin)) {
    return <PermissionDenied />;
  }

  return (
    <Stack gap='sm'>
      <PageDetail
        title={t`Dự án`}
        subtitle={t`Tạo, bật/tắt và cấu hình mã dự án dùng cho hợp đồng, đơn mua và đơn bán`}
        icon={<IconListDetails size={18} />}
      />
      <Alert color='blue' icon={<IconInfoCircle />}>
        <Text size='sm'>
          {t`Mã dự án là khóa nghiệp vụ để gom hợp đồng mua/bán và đơn mua/bán theo cùng một dự án.`}
        </Text>
      </Alert>
      <GlobalSettingList keys={['PROJECT_CODES_ENABLED']} />
      <ProjectCodeTable />
    </Stack>
  );
}
