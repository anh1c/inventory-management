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
        title={t`Projects`}
        subtitle={t`Create, enable, and configure project codes used for contracts, purchase orders, and sales orders`}
        icon={<IconListDetails size={18} />}
      />
      <Alert color='blue' icon={<IconInfoCircle />}>
        <Text size='sm'>
          {t`Project codes group sales and purchase contracts and orders under the same project.`}
        </Text>
      </Alert>
      <GlobalSettingList keys={['PROJECT_CODES_ENABLED']} />
      <ProjectCodeTable />
    </Stack>
  );
}
